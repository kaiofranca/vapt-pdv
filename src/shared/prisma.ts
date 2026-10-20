import { PrismaClient } from '@prisma/client';

export interface ClienteBanco {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $disconnect?: () => Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __vaptPdvPrisma: PrismaClient | undefined;
}

export function obterPrisma(): PrismaClient {
  if (!global.__vaptPdvPrisma) {
    global.__vaptPdvPrisma = new PrismaClient();
  }
  return global.__vaptPdvPrisma;
}
