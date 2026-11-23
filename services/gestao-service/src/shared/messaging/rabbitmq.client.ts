import amqplib from 'amqplib';
import {
  CanalAmqp,
  EXCHANGE_EVENTOS,
  declararTopologiaRabbitMQ,
} from './topology';

export type ConexaoAmqp = Awaited<ReturnType<typeof amqplib.connect>>;

export interface LoggerMensageria {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
}

export interface OpcoesRabbitMQClient {
  url?: string;
  logger?: LoggerMensageria;
  intervaloReconexaoInicialMs?: number;
  intervaloReconexaoMaxMs?: number;
  conectarFn?: (url: string) => Promise<ConexaoAmqp>;
}

export type CallbackConexaoAmqp = (canal: CanalAmqp) => Promise<void> | void;

export function mensageriaHabilitada(url?: string): boolean {
  const valor = (url ?? process.env.RABBITMQ_URL)?.trim();
  return Boolean(valor && valor.toLowerCase() !== 'disabled');
}

export class RabbitMQClient {
  private readonly url?: string;
  private readonly logger?: LoggerMensageria;
  private readonly intervaloReconexaoInicialMs: number;
  private readonly intervaloReconexaoMaxMs: number;
  private readonly conectarFn: (url: string) => Promise<ConexaoAmqp>;

  private conexao: ConexaoAmqp | null = null;
  private canal: CanalAmqp | null = null;
  private conectandoPromise: Promise<CanalAmqp> | null = null;
  private timerReconexao: ReturnType<typeof setTimeout> | null = null;
  private tentativasReconexao = 0;
  private encerrando = false;
  private readonly callbacksConexao: CallbackConexaoAmqp[] = [];

  constructor(opcoesOuUrl?: string | OpcoesRabbitMQClient, logger?: LoggerMensageria) {
    if (typeof opcoesOuUrl === 'string') {
      this.url = opcoesOuUrl;
      this.logger = logger;
      this.intervaloReconexaoInicialMs = 1000;
      this.intervaloReconexaoMaxMs = 30000;
      this.conectarFn = (urlDestino) => amqplib.connect(urlDestino);
    } else {
      this.url = opcoesOuUrl?.url;
      this.logger = opcoesOuUrl?.logger ?? logger;
      this.intervaloReconexaoInicialMs = opcoesOuUrl?.intervaloReconexaoInicialMs ?? 1000;
      this.intervaloReconexaoMaxMs = opcoesOuUrl?.intervaloReconexaoMaxMs ?? 30000;
      this.conectarFn = opcoesOuUrl?.conectarFn ?? ((urlDestino) => amqplib.connect(urlDestino));
    }
  }

  registrarCallbackConexao(callback: CallbackConexaoAmqp): void {
    this.callbacksConexao.push(callback);
  }

  async conectar(): Promise<CanalAmqp> {
    if (this.canal) {
      return this.canal;
    }

    if (this.conectandoPromise) {
      return this.conectandoPromise;
    }

    if (this.timerReconexao) {
      clearTimeout(this.timerReconexao);
      this.timerReconexao = null;
    }

    this.encerrando = false;

    const urlConexao = (this.url ?? process.env.RABBITMQ_URL)?.trim();
    if (!urlConexao || urlConexao.toLowerCase() === 'disabled') {
      throw new Error('RABBITMQ_URL não configurada ou desabilitada.');
    }

    this.conectandoPromise = (async () => {
      const conexao = await this.conectarFn(urlConexao);

      if (this.encerrando) {
        if (typeof conexao.close === 'function') {
          await conexao.close().catch(() => undefined);
        }
        throw new Error('Cliente RabbitMQ encerrado durante a conexão.');
      }

      let canalAmqp: CanalAmqp;
      if (typeof conexao.createConfirmChannel === 'function') {
        try {
          canalAmqp = await conexao.createConfirmChannel();
        } catch {
          canalAmqp = await conexao.createChannel();
        }
      } else {
        canalAmqp = await conexao.createChannel();
      }

      await declararTopologiaRabbitMQ(canalAmqp);

      conexao.on('error', (erro: Error) => {
        this.logger?.error?.({ erro }, 'Erro na conexão RabbitMQ.');
      });

      conexao.on('close', () => {
        this.conexao = null;
        this.canal = null;
        if (!this.encerrando) {
          this.logger?.warn?.('Conexão RabbitMQ encerrada. Agendando reconexão com backoff...');
          this.agendarReconexao();
        }
      });

      const emissorCanal = canalAmqp as unknown as {
        on?: (evento: string, listener: (...args: unknown[]) => void) => void;
      };
      emissorCanal.on?.('error', (erro: unknown) => {
        this.logger?.error?.({ erro }, 'Erro no canal RabbitMQ.');
      });
      emissorCanal.on?.('close', () => {
        if (this.canal === canalAmqp) {
          this.canal = null;
        }
      });

      this.conexao = conexao;
      this.canal = canalAmqp;
      this.tentativasReconexao = 0;

      for (const callback of this.callbacksConexao) {
        await callback(canalAmqp);
      }

      return canalAmqp;
    })();

    try {
      return await this.conectandoPromise;
    } finally {
      this.conectandoPromise = null;
    }
  }

  agendarReconexao(): void {
    if (this.encerrando || this.timerReconexao) {
      return;
    }

    const atraso = Math.min(
      this.intervaloReconexaoInicialMs * Math.pow(2, this.tentativasReconexao),
      this.intervaloReconexaoMaxMs,
    );
    this.tentativasReconexao += 1;

    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      if (this.encerrando) {
        return;
      }
      void this.conectar().catch((erro) => {
        this.logger?.error?.(
          { erro, tentativa: this.tentativasReconexao },
          'Falha na tentativa de reconexão ao RabbitMQ.',
        );
        this.agendarReconexao();
      });
    }, atraso);

    if (typeof this.timerReconexao.unref === 'function') {
      this.timerReconexao.unref();
    }
  }

  async publicarEvento(
    routingKey: string,
    payload: unknown,
    opcoes?: { messageId?: string; headers?: Record<string, unknown> },
  ): Promise<boolean> {
    if (!this.canal) {
      throw new Error('Canal RabbitMQ não conectado.');
    }

    const conteudo = Buffer.from(JSON.stringify(payload), 'utf-8');
    const messageId =
      opcoes?.messageId ??
      (typeof payload === 'object' && payload !== null && 'evento_id' in payload
        ? String((payload as { evento_id: unknown }).evento_id)
        : undefined);

    const enviado = this.canal.publish(EXCHANGE_EVENTOS, routingKey, conteudo, {
      persistent: true,
      deliveryMode: 2,
      contentType: 'application/json',
      messageId,
      headers: opcoes?.headers,
    });

    if (typeof this.canal.waitForConfirms === 'function') {
      await this.canal.waitForConfirms();
    }

    return enviado;
  }

  obterCanal(): CanalAmqp | null {
    return this.canal;
  }

  estaConectado(): boolean {
    return this.conexao !== null && this.canal !== null;
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

    if (canalAtual?.close) {
      try {
        await canalAtual.close();
      } catch (erro) {
        this.logger?.warn?.({ erro }, 'Erro ao fechar canal RabbitMQ.');
      }
    }

    if (conexaoAtual?.close) {
      try {
        await conexaoAtual.close();
      } catch (erro) {
        this.logger?.warn?.({ erro }, 'Erro ao fechar conexão RabbitMQ.');
      }
    }
  }
}
