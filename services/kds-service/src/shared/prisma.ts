import { PrismaClient } from '@prisma/client';

export type ClienteBanco = {
  $queryRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<any>;
  $disconnect: () => Promise<void>;
  fichaPreparo?: any;
  eventoProcessado?: any;
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

