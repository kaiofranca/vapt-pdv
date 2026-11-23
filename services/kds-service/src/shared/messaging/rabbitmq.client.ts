import amqplib from 'amqplib';
import {
  CanalAmqp,
  declararTopologiaRabbitMQ,
  EXCHANGE_EVENTOS,
} from './topology';

export type ConexaoAmqp = Awaited<ReturnType<typeof amqplib.connect>>;

export type CallbackConexaoAmqp = (canal: CanalAmqp) => Promise<void> | void;

export interface LoggerRabbitMQ {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
}

/**
 * Indica se a mensageria AMQP está habilitada a partir de RABBITMQ_URL.
 */
export function mensageriaHabilitada(url?: string): boolean {
  const valor = (url ?? process.env.RABBITMQ_URL)?.trim();
  return Boolean(valor && valor.toLowerCase() !== 'disabled');
}

/**
 * Cliente gerenciador de conexão, canal de confirmação e publicação de eventos no RabbitMQ.
 */
export class RabbitMQClient {
  private readonly url: string;
  private readonly logger?: LoggerRabbitMQ;
  private conexao: ConexaoAmqp | null = null;
  private canal: CanalAmqp | null = null;
  private callbacksConexao: CallbackConexaoAmqp[] = [];
  private timerReconexao: NodeJS.Timeout | null = null;
  private tentativasReconexao = 0;
  private encerrando = false;
  private promessaConexao: Promise<CanalAmqp> | null = null;

  constructor(url?: string, logger?: LoggerRabbitMQ) {
    this.url = (url ?? process.env.RABBITMQ_URL ?? '').trim();
    this.logger = logger;
  }

  /**
   * Registra callback executado após conexão/reconexão bem-sucedida para re-registrar consumidores.
   */
  registrarCallbackConexao(cb: CallbackConexaoAmqp): void {
    this.callbacksConexao.push(cb);
    if (this.canal && this.estaConectado()) {
      void Promise.resolve(cb(this.canal)).catch((erro) => {
        this.logger?.error?.({ err: erro }, 'Erro ao executar callback de conexão RabbitMQ.');
      });
    }
  }

  /**
   * Estabelece conexão AMQP, cria canal com publisher confirms e declara a topologia.
   */
  async conectar(): Promise<CanalAmqp> {
    if (this.canal && this.estaConectado()) {
      return this.canal;
    }

    if (this.promessaConexao) {
      return this.promessaConexao;
    }

    this.encerrando = false;

    this.promessaConexao = (async () => {
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

      if (typeof conexao.on === 'function') {
        conexao.on('error', (erro: unknown) => {
          this.logger?.error?.({ err: erro }, 'Erro na conexão RabbitMQ.');
        });

        conexao.on('close', () => {
          this.canal = null;
          this.conexao = null;
          if (!this.encerrando) {
            this.logger?.warn?.('Conexão RabbitMQ encerrada inesperadamente. Agendando reconexão.');
            this.agendarReconexao();
          }
        });
      }

      if (typeof canal.on === 'function') {
        canal.on('error', (erro: unknown) => {
          this.logger?.error?.({ err: erro }, 'Erro no canal RabbitMQ.');
        });

        canal.on('close', () => {
          if (this.canal === canal) {
            this.canal = null;
          }
        });
      }

      for (const cb of this.callbacksConexao) {
        await cb(canal);
      }

      this.logger?.info?.('Conectado ao RabbitMQ e topologia VaptPDV declarada.');
      return canal;
    })();

    try {
      return await this.promessaConexao;
    } finally {
      this.promessaConexao = null;
    }
  }

  /**
   * Agenda reconexão automática com backoff exponencial (até 30s).
   */
  agendarReconexao(): void {
    if (this.encerrando || this.timerReconexao) {
      return;
    }

    const atrasoMs = Math.min(1000 * 2 ** this.tentativasReconexao, 30000);
    this.tentativasReconexao += 1;

    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      if (this.encerrando) {
        return;
      }

      void this.conectar().catch((erro) => {
        this.logger?.error?.({ err: erro }, 'Falha ao reconectar ao RabbitMQ.');
        this.agendarReconexao();
      });
    }, atrasoMs);

    if (typeof this.timerReconexao.unref === 'function') {
      this.timerReconexao.unref();
    }
  }

  /**
   * Publica um evento JSON persistente no exchange principal vaptpdv.eventos.
   */
  async publicarEvento(
    tipoEvento: string,
    payload: unknown,
    messageId: string,
  ): Promise<void> {
    if (!this.canal) {
      throw new Error('Canal RabbitMQ não está conectado para publicação de eventos.');
    }

    const conteudo = Buffer.from(JSON.stringify(payload), 'utf-8');
    this.canal.publish(EXCHANGE_EVENTOS, tipoEvento, conteudo, {
      persistent: true,
      deliveryMode: 2,
      messageId,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    if (typeof this.canal.waitForConfirms === 'function') {
      await this.canal.waitForConfirms();
    }
  }

  obterCanal(): CanalAmqp | null {
    return this.canal;
  }

  estaConectado(): boolean {
    return Boolean(this.conexao && this.canal && !this.encerrando);
  }

  async fechar(): Promise<void> {
    this.encerrando = true;

    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    const canalAtual = this.canal;
    const conexaoAtual = this.conexao;
    this.canal = null;
    this.conexao = null;

    if (canalAtual && typeof canalAtual.close === 'function') {
      await canalAtual.close().catch(() => undefined);
    }

    if (conexaoAtual && typeof conexaoAtual.close === 'function') {
      await conexaoAtual.close().catch(() => undefined);
    }
  }
}
