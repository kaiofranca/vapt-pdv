import { PrismaClient } from '@prisma/client';

export type ClienteBanco = PrismaClient;

let instanciaPrisma: PrismaClient | null = null;

export function obterPrisma(urlBanco?: string): PrismaClient {
  if (!instanciaPrisma) {
    instanciaPrisma = new PrismaClient({
      datasources: urlBanco
        ? {
            db: {
              url: urlBanco,
            },
          }
        : undefined,
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    });
  }

  return instanciaPrisma;
}

export async function desconectarPrisma(): Promise<void> {
  if (instanciaPrisma) {
    await instanciaPrisma.$disconnect();
    instanciaPrisma = null;
  }
}
