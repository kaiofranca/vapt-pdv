import amqplib from 'amqplib';
import {
  CanalAmqp,
  EXCHANGE_EVENTOS,
  declararTopologiaRabbitMQ,
} from './topology';

export type ConexaoAmqp = Awaited<ReturnType<typeof amqplib.connect>>;

export interface LoggerMensageria {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
}

export interface OpcoesRabbitMQClient {
  url?: string;
  logger?: LoggerMensageria;
  intervaloReconexaoMs?: number;
  maxIntervaloReconexaoMs?: number;
}

export type CallbackConexaoAmqp = (canal: CanalAmqp) => Promise<void> | void;

/**
 * Indica se a mensageria RabbitMQ está habilitada conforme URL informada ou RABBITMQ_URL.
 */
export function mensageriaHabilitada(url?: string): boolean {
  const valor = (url ?? process.env.RABBITMQ_URL)?.trim();
  return Boolean(valor) && valor!.toLowerCase() !== 'disabled';
}

/**
 * Cliente AMQP com ConfirmChannel, declaração automática da topologia VaptPDV,
 * reconexão com backoff exponencial e callbacks pós-conexão.
 */
export class RabbitMQClient {
  private readonly url: string;
  private readonly intervaloReconexaoMs: number;
  private readonly maxIntervaloReconexaoMs: number;
  private logger?: LoggerMensageria;

  private conexao: ConexaoAmqp | null = null;
  private canal: CanalAmqp | null = null;
  private conectando: Promise<CanalAmqp> | null = null;
  private fechando = false;
  private tentativasReconexao = 0;
  private timerReconexao: NodeJS.Timeout | null = null;
  private readonly callbacksConexao: CallbackConexaoAmqp[] = [];

  constructor(urlOuOpcoes?: string | OpcoesRabbitMQClient, logger?: LoggerMensageria) {
    const opcoes: OpcoesRabbitMQClient =
      typeof urlOuOpcoes === 'string' ? { url: urlOuOpcoes, logger } : (urlOuOpcoes ?? {});

    this.url =
      opcoes.url?.trim() || process.env.RABBITMQ_URL?.trim() || 'amqp://localhost:5672';
    this.logger = opcoes.logger ?? logger;
    this.intervaloReconexaoMs = opcoes.intervaloReconexaoMs ?? 1000;
    this.maxIntervaloReconexaoMs = opcoes.maxIntervaloReconexaoMs ?? 30000;
  }

  definirLogger(logger: LoggerMensageria): void {
    this.logger = logger;
  }

  registrarCallbackConexao(callback: CallbackConexaoAmqp): void {
    this.callbacksConexao.push(callback);
  }

  obterCanal(): CanalAmqp | null {
    return this.canal;
  }

  estaConectado(): boolean {
    return this.conexao !== null && this.canal !== null && !this.fechando;
  }

  /**
   * Abre conexão e ConfirmChannel (com fallback para createChannel), declara topologia
   * e executa callbacks registrados.
   */
  async conectar(): Promise<CanalAmqp> {
    if (this.canal && !this.fechando) {
      return this.canal;
    }

    if (this.conectando) {
      return this.conectando;
    }

    this.fechando = false;
    this.conectando = this.estabelecerConexao();

    try {
      return await this.conectando;
    } finally {
      this.conectando = null;
    }
  }

  private async estabelecerConexao(): Promise<CanalAmqp> {
    const conexao = await amqplib.connect(this.url);

    conexao.on('error', (erro) => {
      this.logger?.error?.({ erro }, '[RabbitMQClient] Erro na conexão AMQP.');
    });

    conexao.on('close', () => {
      this.conexao = null;
      this.canal = null;
      if (!this.fechando) {
        this.logger?.warn?.('[RabbitMQClient] Conexão AMQP encerrada. Agendando reconexão...');
        this.agendarReconexao();
      }
    });

    let canal: CanalAmqp;
    if (typeof conexao.createConfirmChannel === 'function') {
      canal = (await conexao.createConfirmChannel()) as unknown as CanalAmqp;
    } else {
      canal = (await conexao.createChannel()) as unknown as CanalAmqp;
    }

    canal.on?.('error', (erro: unknown) => {
      this.logger?.error?.({ erro }, '[RabbitMQClient] Erro no canal AMQP.');
    });

    canal.on?.('close', () => {
      if (this.canal === canal) {
        this.canal = null;
      }
    });

    await declararTopologiaRabbitMQ(canal);

    this.conexao = conexao;
    this.canal = canal;
    this.tentativasReconexao = 0;

    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    for (const callback of this.callbacksConexao) {
      await callback(canal);
    }

    this.logger?.info?.('[RabbitMQClient] Conectado ao RabbitMQ e topologia declarada.');
    return canal;
  }

  /**
   * Agenda tentativa de reconexão com backoff exponencial limitado.
   */
  agendarReconexao(): void {
    if (this.fechando || this.timerReconexao) {
      return;
    }

    this.tentativasReconexao += 1;
    const atraso = Math.min(
      this.intervaloReconexaoMs * Math.pow(2, this.tentativasReconexao - 1),
      this.maxIntervaloReconexaoMs,
    );

    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      if (this.fechando) {
        return;
      }
      void this.conectar().catch((erro) => {
        this.logger?.warn?.(
          { erro, tentativa: this.tentativasReconexao },
          '[RabbitMQClient] Falha ao reconectar ao RabbitMQ.',
        );
        this.agendarReconexao();
      });
    }, atraso);

    this.timerReconexao.unref?.();
  }

  /**
   * Publica um evento JSON persistente na exchange principal e aguarda publisher confirm.
   */
  async publicarEvento(
    tipoEvento: string,
    payload: unknown,
    messageId: string,
  ): Promise<void> {
    if (!this.canal || this.fechando) {
      throw new Error('Canal RabbitMQ não conectado para publicação.');
    }

    const textoPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const conteudo = Buffer.from(textoPayload, 'utf-8');

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

  /**
   * Fecha canal e conexão AMQP de forma graciosa, cancelando timers pendentes.
   */
  async fechar(): Promise<void> {
    this.fechando = true;

    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    const canalAtual = this.canal;
    this.canal = null;
    if (canalAtual?.close) {
      await canalAtual.close().catch(() => {});
    }

    const conexaoAtual = this.conexao;
    this.conexao = null;
    if (conexaoAtual?.close) {
      await conexaoAtual.close().catch(() => {});
    }
  }
}
