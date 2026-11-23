import { PrismaClient } from '@prisma/client';

export type ClienteBanco = {
  $queryRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<any>;
  $disconnect?: () => Promise<void>;
  $transaction?: <T>(fn: (tx: ClienteBanco) => Promise<T>) => Promise<T>;
  fichaPreparo?: any;
  eventoProcessado?: any;
  outboxEvento?: any;
};

let prismaInstance: PrismaClient | null = null;

export function obterPrisma(databaseUrl?: string): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: databaseUrl
        ? {
            db: {
              url: databaseUrl,
            },
          }
        : undefined,
    });
  }
  return prismaInstance;
}

export async function desconectarPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
