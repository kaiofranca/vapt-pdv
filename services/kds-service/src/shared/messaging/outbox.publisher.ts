import { randomUUID } from 'node:crypto';
import { ClienteBanco } from '../prisma';

export interface DadosEventoOutbox {
  id?: string;
  tipoEvento: string;
  chaveAgregado: string;
  payload: Record<string, unknown> | unknown;
}

export interface PublicadorEventosAmqp {
  publicarEvento(tipoEvento: string, payload: unknown, messageId: string): Promise<void>;
  estaConectado?(): boolean;
}

export interface OpcoesOutboxPublisher {
  intervaloMs?: number;
  tamanhoLote?: number;
  logger?: {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
}

export async function gravarEventoOutbox(
  prismaOuTx: ClienteBanco | any,
  dados: DadosEventoOutbox,
): Promise<any | null> {
  if (typeof prismaOuTx?.outboxEvento?.create !== 'function') {
    return null;
  }

  const id = dados.id ?? randomUUID();

  return prismaOuTx.outboxEvento.create({
    data: {
      id,
      tipoEvento: dados.tipoEvento,
      chaveAgregado: dados.chaveAgregado,
      payload: dados.payload,
      status: 'PENDENTE',
      tentativas: 0,
    },
  });
}

export class OutboxPublisher {
  readonly intervaloMs: number;
  readonly tamanhoLote: number;
  private readonly logger?: OpcoesOutboxPublisher['logger'];
  private timer: NodeJS.Timeout | null = null;
  private processando = false;
  private pendenteNovaExecucao = false;
  private ativo = false;

  constructor(
    private readonly prisma: ClienteBanco,
    private readonly rabbitClient: PublicadorEventosAmqp,
    opcoes: OpcoesOutboxPublisher = {},
  ) {
    this.intervaloMs = opcoes.intervaloMs ?? 500;
    this.tamanhoLote = opcoes.tamanhoLote ?? 50;
    this.logger = opcoes.logger;
  }

  async processarLote(): Promise<number> {
    if (this.processando) {
      this.pendenteNovaExecucao = true;
      return 0;
    }

    if (typeof this.prisma?.outboxEvento?.findMany !== 'function') {
      return 0;
    }

    if (
      typeof this.rabbitClient.estaConectado === 'function' &&
      !this.rabbitClient.estaConectado()
    ) {
      return 0;
    }

    this.processando = true;
    let publicados = 0;

    try {
      const pendentes = await this.prisma.outboxEvento.findMany({
        where: { status: 'PENDENTE' },
        orderBy: { criadoEm: 'asc' },
        take: this.tamanhoLote,
      });

      for (const evento of pendentes) {
        try {
          await this.rabbitClient.publicarEvento(
            evento.tipoEvento,
            evento.payload,
            evento.id,
          );

          if (typeof this.prisma.outboxEvento?.update === 'function') {
            await this.prisma.outboxEvento.update({
              where: { id: evento.id },
              data: {
                status: 'PUBLICADO',
                publicadoEm: new Date(),
              },
            });
          }

          publicados += 1;
        } catch (erro) {
          this.logger?.error?.(
            { err: erro, outboxId: evento.id, tipoEvento: evento.tipoEvento },
            'Falha ao publicar evento do outbox no RabbitMQ.',
          );

          if (typeof this.prisma.outboxEvento?.update === 'function') {
            await this.prisma.outboxEvento
              .update({
                where: { id: evento.id },
                data: {
                  tentativas: Number(evento.tentativas ?? 0) + 1,
                },
              })
              .catch(() => undefined);
          }
        }
      }
    } finally {
      this.processando = false;
    }

    if (this.pendenteNovaExecucao && this.ativo) {
      this.pendenteNovaExecucao = false;
      setImmediate(() => {
        void this.processarLote();
      });
    }

    return publicados;
  }

  iniciar(): void {
    if (this.timer) {
      return;
    }

    this.ativo = true;
    this.timer = setInterval(() => {
      void this.processarLote();
    }, this.intervaloMs);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  notificarNovoEvento(): void {
    if (!this.ativo) {
      return;
    }

    if (this.processando) {
      this.pendenteNovaExecucao = true;
      return;
    }

    void this.processarLote();
  }

  parar(): void {
    this.ativo = false;
    this.pendenteNovaExecucao = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
