import amqplib from 'amqplib';
import {
  CanalAmqp,
  declararTopologiaRabbitMQ,
  EXCHANGE_EVENTOS,
} from './topology';

export type ConexaoAmqp = Awaited<ReturnType<typeof amqplib.connect>>;

export interface LoggerRabbitMQ {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

export type CallbackConexaoAmqp = (canal: CanalAmqp) => Promise<void> | void;

export interface OpcoesRabbitMQClient {
  atrasoBaseReconexaoMs?: number;
  atrasoMaximoReconexaoMs?: number;
}

/**
 * Indica se a mensageria RabbitMQ está habilitada pela URL informada ou via `RABBITMQ_URL`.
 */
export function mensageriaHabilitada(url?: string): boolean {
  const valor = (url ?? process.env.RABBITMQ_URL)?.trim();
  return Boolean(valor && valor.toLowerCase() !== 'disabled');
}

/**
 * Cliente resiliente de conexão, publicação com Publisher Confirms e reconexão automática ao RabbitMQ.
 */
export class RabbitMQClient {
  private readonly url: string;
  private readonly atrasoBaseMs: number;
  private readonly atrasoMaximoMs: number;
  private conexao: ConexaoAmqp | null = null;
  private canal: CanalAmqp | null = null;
  private fechando = false;
  private conectando: Promise<CanalAmqp> | null = null;
  private tentativasReconexao = 0;
  private timerReconexao: ReturnType<typeof setTimeout> | null = null;
  private readonly callbacksConexao: CallbackConexaoAmqp[] = [];

  constructor(
    url?: string,
    private readonly logger?: LoggerRabbitMQ,
    opcoes?: OpcoesRabbitMQClient,
  ) {
    this.url = (url ?? process.env.RABBITMQ_URL ?? '').trim();
    this.atrasoBaseMs = opcoes?.atrasoBaseReconexaoMs ?? 1000;
    this.atrasoMaximoMs = opcoes?.atrasoMaximoReconexaoMs ?? 30000;
  }

  /**
   * Registra callback invocado após conectar e em todas as reconexões futuras.
   */
  registrarCallbackConexao(cb: CallbackConexaoAmqp): void {
    this.callbacksConexao.push(cb);
  }

  /**
   * Estabelece conexão AMQP, cria canal (ConfirmChannel com fallback), declara a topologia
   * e executa os callbacks registrados para subscrição de consumidores.
   */
  async conectar(): Promise<CanalAmqp> {
    if (this.canal && this.conexao) {
      return this.canal;
    }

    if (this.conectando) {
      return this.conectando;
    }

    if (!this.url || this.url.toLowerCase() === 'disabled') {
      throw new Error('RABBITMQ_URL não configurada ou desabilitada.');
    }

    this.fechando = false;
    this.conectando = (async () => {
      const conexao = await amqplib.connect(this.url);
      const canalBruto =
        typeof conexao.createConfirmChannel === 'function'
          ? await conexao.createConfirmChannel()
          : await conexao.createChannel();
      const canal = canalBruto as unknown as CanalAmqp;

      await declararTopologiaRabbitMQ(canal);

      this.conexao = conexao;
      this.canal = canal;
      this.tentativasReconexao = 0;

      if (typeof (canalBruto as any)?.on === 'function') {
        (canalBruto as any).on('error', (erro: unknown) => {
          this.logger?.warn?.({ err: erro }, '[RabbitMQ] Erro no canal AMQP.');
        });
        (canalBruto as any).on('close', () => {
          if (this.canal === canal) {
            this.canal = null;
          }
        });
      }

      if (typeof conexao.on === 'function') {
        conexao.on('error', (erro: unknown) => {
          this.logger?.warn?.({ err: erro }, '[RabbitMQ] Erro na conexão AMQP.');
        });

        conexao.on('close', () => {
          this.canal = null;
          this.conexao = null;
          if (!this.fechando) {
            this.logger?.warn?.('[RabbitMQ] Conexão encerrada inesperadamente. Agendando reconexão...');
            this.agendarReconexao();
          }
        });
      }

      for (const cb of this.callbacksConexao) {
        await cb(canal);
      }

      return canal;
    })();

    try {
      return await this.conectando;
    } finally {
      this.conectando = null;
    }
  }

  private agendarReconexao(): void {
    if (this.fechando || this.timerReconexao) {
      return;
    }

    const atraso = Math.min(
      this.atrasoBaseMs * Math.pow(2, this.tentativasReconexao),
      this.atrasoMaximoMs,
    );
    this.tentativasReconexao += 1;

    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      if (this.fechando) {
        return;
      }
      void this.conectar().catch((erro) => {
        this.logger?.warn?.(
          { err: erro, tentativa: this.tentativasReconexao },
          '[RabbitMQ] Falha ao reconectar ao broker.',
        );
        this.agendarReconexao();
      });
    }, atraso);

    if (typeof this.timerReconexao.unref === 'function') {
      this.timerReconexao.unref();
    }
  }

  /**
   * Publica um evento em JSON UTF-8 no exchange principal com persistência e Publisher Confirm.
   */
  async publicarEvento(
    tipoEvento: string,
    payload: unknown,
    messageId: string,
  ): Promise<void> {
    if (!this.canal) {
      throw new Error('Canal RabbitMQ não está conectado.');
    }

    const buffer = Buffer.from(JSON.stringify(payload), 'utf8');
    this.canal.publish(EXCHANGE_EVENTOS, tipoEvento, buffer, {
      persistent: true,
      deliveryMode: 2,
      messageId,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    if (typeof (this.canal as any).waitForConfirms === 'function') {
      await (this.canal as any).waitForConfirms();
    }
  }

  obterCanal(): CanalAmqp | null {
    return this.canal;
  }

  estaConectado(): boolean {
    return this.conexao !== null && this.canal !== null;
  }

  async fechar(): Promise<void> {
    this.fechando = true;
    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    const canalAtual = this.canal;
    const conexaoAtual = this.conexao;
    this.canal = null;
    this.conexao = null;

    if (canalAtual?.close) {
      await canalAtual.close().catch(() => undefined);
    }

    if (conexaoAtual && typeof conexaoAtual.close === 'function') {
      await conexaoAtual.close().catch(() => undefined);
    }
  }
}
