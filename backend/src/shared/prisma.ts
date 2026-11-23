import { PrismaClient } from '@prisma/client';

export interface ClienteBanco {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $disconnect?: () => Promise<void>;
  $transaction?: <T>(fn: (tx: ClienteBanco) => Promise<T>) => Promise<T>;
  usuario?: PrismaClient['usuario'];
  produto?: PrismaClient['produto'];
  movimentoEstoque?: PrismaClient['movimentoEstoque'];
  comanda?: PrismaClient['comanda'];
  itemComanda?: PrismaClient['itemComanda'];
  outboxEvento?: PrismaClient['outboxEvento'];
  eventoProcessado?: PrismaClient['eventoProcessado'];
}

declare global {
  var __vaptPdvPrisma: PrismaClient | undefined;
}

export function obterPrisma(): PrismaClient {
  if (!global.__vaptPdvPrisma) {
    global.__vaptPdvPrisma = new PrismaClient();
  }
  return global.__vaptPdvPrisma;
}
