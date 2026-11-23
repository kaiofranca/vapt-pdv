import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../prisma';

export interface DadosGravacaoOutbox {
  id?: string;
  tipoEvento: string;
  chaveAgregado: string;
  payload: unknown;
}

export interface RegistroOutbox {
  id: string;
  tipoEvento: string;
  chaveAgregado: string;
  payload: unknown;
  status: string;
  tentativas: number;
  criadoEm: Date;
  publicadoEm?: Date | null;
}

export interface OutboxPrismaAdapter {
  outboxEvento?: {
    create?: (args: any) => Promise<unknown>;
    findMany: (args: any) => Promise<RegistroOutbox[]>;
    update: (args: any) => Promise<unknown>;
  };
}

export interface LoggerOutbox {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

export interface OpcoesOutboxPublisher {
  intervaloMs?: number;
  tamanhoLote?: number;
}

export async function gravarEventoOutbox(
  prismaOuTx: ClienteBanco | OutboxPrismaAdapter | undefined | null,
  dados: DadosGravacaoOutbox,
): Promise<string> {
  const id = dados.id ?? crypto.randomUUID();
  const repoOutbox = (prismaOuTx as OutboxPrismaAdapter | undefined | null)?.outboxEvento;

  if (!repoOutbox || typeof repoOutbox.create !== 'function') {
    return id;
  }

  await repoOutbox.create({
    data: {
      id,
      tipoEvento: dados.tipoEvento,
      chaveAgregado: dados.chaveAgregado,
      payload: dados.payload as Prisma.InputJsonValue,
      status: 'PENDENTE',
      tentativas: 0,
    },
  });

  return id;
}

export class OutboxPublisher {
  private readonly intervaloMs: number;
  private readonly tamanhoLote: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private emExecucao = false;

  constructor(
    private readonly prisma: ClienteBanco | OutboxPrismaAdapter,
    private readonly publicarEvento: (
      tipoEvento: string,
      payload: unknown,
      messageId: string,
    ) => Promise<void>,
    private readonly logger?: LoggerOutbox,
    opcoes?: OpcoesOutboxPublisher,
  ) {
    this.intervaloMs = opcoes?.intervaloMs ?? 500;
    this.tamanhoLote = opcoes?.tamanhoLote ?? 50;
  }

  async processarLote(): Promise<void> {
    if (this.emExecucao) {
      return;
    }

    const repoOutbox = (this.prisma as OutboxPrismaAdapter)?.outboxEvento;
    if (!repoOutbox || typeof repoOutbox.findMany !== 'function') {
      return;
    }

    this.emExecucao = true;
    try {
      const pendentes = await repoOutbox.findMany({
        where: { status: 'PENDENTE' },
        orderBy: { criadoEm: 'asc' },
        take: this.tamanhoLote,
      });

      for (const reg of pendentes) {
        try {
          await this.publicarEvento(reg.tipoEvento, reg.payload, reg.id);
          await repoOutbox.update({
            where: { id: reg.id },
            data: {
              status: 'PUBLICADO',
              publicadoEm: new Date(),
            },
          });
        } catch (erro) {
          this.logger?.warn?.(
            { err: erro, outboxId: reg.id, tipoEvento: reg.tipoEvento },
            '[OutboxPublisher] Falha ao publicar evento; incrementando tentativas.',
          );
          await repoOutbox
            .update({
              where: { id: reg.id },
              data: {
                tentativas: { increment: 1 },
              },
            })
            .catch((erroUpdate: unknown) => {
              this.logger?.error?.(
                { err: erroUpdate, outboxId: reg.id },
                '[OutboxPublisher] Falha ao atualizar contador de tentativas.',
              );
            });
        }
      }
    } catch (erro) {
      this.logger?.warn?.(
        { err: erro },
        '[OutboxPublisher] Falha ao buscar lote de eventos pendentes.',
      );
    } finally {
      this.emExecucao = false;
    }
  }

  iniciar(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.processarLote();
    }, this.intervaloMs);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  notificarNovoEvento(): void {
    void this.processarLote();
  }

  parar(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
