import crypto from 'node:crypto';
import { LoggerMensageria } from './rabbitmq.client';

export interface OutboxEventoRegistro {
  id: string;
  tipoEvento: string;
  chaveAgregado: string;
  payload: unknown;
  status: string;
  tentativas: number;
  criadoEm: Date;
  publicadoEm: Date | null;
}

export interface ClienteOutboxDb {
  outboxEvento?: {
    create(args: {
      data: {
        id: string;
        tipoEvento: string;
        chaveAgregado: string;
        payload: any;
        status: string;
        tentativas: number;
      };
    }): Promise<OutboxEventoRegistro>;
    findMany(args: {
      where: { status: string };
      orderBy: { criadoEm: 'asc' | 'desc' };
      take: number;
    }): Promise<OutboxEventoRegistro[]>;
    update(args: {
      where: { id: string };
      data: {
        status?: string;
        publicadoEm?: Date | null;
        tentativas?: number;
      };
    }): Promise<OutboxEventoRegistro>;
  };
}

export interface DadosNovoOutboxEvento {
  id?: string;
  tipoEvento: string;
  chaveAgregado: string;
  payload: unknown;
}

export interface PublicadorEventos {
  publicarEvento(tipoEvento: string, payload: unknown, messageId: string): Promise<void>;
  estaConectado(): boolean;
}

export interface OpcoesOutboxPublisher {
  intervaloMs?: number;
  tamanhoLote?: number;
  logger?: LoggerMensageria;
}

/**
 * Grava um evento pendente na tabela outbox_eventos dentro da mesma transação
 * ou cliente Prisma informado, preservando compatibilidade com mocks parciais.
 */
export async function gravarEventoOutbox(
  prismaOuTx: ClienteOutboxDb | Record<string, any> | undefined | null,
  dados: DadosNovoOutboxEvento,
): Promise<OutboxEventoRegistro | null> {
  const outbox = prismaOuTx?.outboxEvento;
  if (typeof outbox?.create !== 'function') {
    return null;
  }

  return outbox.create({
    data: {
      id: dados.id ?? crypto.randomUUID(),
      tipoEvento: dados.tipoEvento,
      chaveAgregado: dados.chaveAgregado,
      payload: dados.payload,
      status: 'PENDENTE',
      tentativas: 0,
    },
  });
}

/**
 * Worker em background responsável por drenar eventos PENDENTE de outbox_eventos
 * e publicá-los no RabbitMQ com confirmação e controle de tentativas.
 */
export class OutboxPublisher {
  private readonly intervaloMs: number;
  private readonly tamanhoLote: number;
  private logger?: LoggerMensageria;

  private timer: NodeJS.Timeout | null = null;
  private processando = false;
  private reprocessarPendente = false;
  private parado = false;

  constructor(
    private readonly prisma: ClienteOutboxDb,
    private readonly publicador: PublicadorEventos,
    opcoes: OpcoesOutboxPublisher = {},
  ) {
    this.intervaloMs = opcoes.intervaloMs ?? 500;
    this.tamanhoLote = opcoes.tamanhoLote ?? 50;
    this.logger = opcoes.logger;
  }

  definirLogger(logger: LoggerMensageria): void {
    this.logger = logger;
  }

  /**
   * Varre um lote de eventos PENDENTE ordenados por criadoEm ASC e os publica.
   */
  async processarLote(): Promise<number> {
    if (this.parado) {
      return 0;
    }

    if (typeof this.publicador.estaConectado === 'function' && !this.publicador.estaConectado()) {
      return 0;
    }

    if (this.processando) {
      this.reprocessarPendente = true;
      return 0;
    }

    const outboxRepo = this.prisma?.outboxEvento;
    if (!outboxRepo?.findMany || !outboxRepo?.update) {
      return 0;
    }

    this.processando = true;
    let totalPublicados = 0;

    try {
      do {
        this.reprocessarPendente = false;

        const pendentes = await outboxRepo.findMany({
          where: { status: 'PENDENTE' },
          orderBy: { criadoEm: 'asc' },
          take: this.tamanhoLote,
        });

        for (const evento of pendentes) {
          if (this.parado) {
            break;
          }

          try {
            await this.publicador.publicarEvento(
              evento.tipoEvento,
              evento.payload,
              evento.id,
            );

            await outboxRepo.update({
              where: { id: evento.id },
              data: {
                status: 'PUBLICADO',
                publicadoEm: new Date(),
              },
            });

            totalPublicados += 1;
          } catch (erro) {
            this.logger?.warn?.(
              { erro, eventoId: evento.id, tipoEvento: evento.tipoEvento },
              '[OutboxPublisher] Falha ao publicar evento do outbox. Mantendo PENDENTE.',
            );

            await outboxRepo
              .update({
                where: { id: evento.id },
                data: {
                  tentativas: evento.tentativas + 1,
                },
              })
              .catch(() => {});
          }
        }
      } while (this.reprocessarPendente && !this.parado);
    } finally {
      this.processando = false;
    }

    return totalPublicados;
  }

  /**
   * Inicia o polling periódico em background sem bloquear o encerramento do processo.
   */
  iniciar(): void {
    this.parado = false;
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.processarLote().catch((erro) => {
        this.logger?.error?.({ erro }, '[OutboxPublisher] Erro inesperado ao processar lote.');
      });
    }, this.intervaloMs);

    this.timer.unref?.();
  }

  /**
   * Aciona processamento imediato pós-commit quando um novo evento é gravado.
   */
  notificarNovoEvento(): void {
    if (this.parado) {
      return;
    }

    void this.processarLote().catch((erro) => {
      this.logger?.error?.({ erro }, '[OutboxPublisher] Erro no gatilho imediato do outbox.');
    });
  }

  /**
   * Interrompe o worker periódico do outbox.
   */
  parar(): void {
    this.parado = true;
    this.reprocessarPendente = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
