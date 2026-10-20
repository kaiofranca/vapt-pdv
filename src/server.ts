import { FastifyInstance } from 'fastify';
import { carregarEnv } from './config/env';
import { buildApp } from './app';
import { obterPrisma } from './shared/prisma';

export async function iniciarServidor(): Promise<void> {
  const env = carregarEnv();
  const prisma = obterPrisma();
  let app: FastifyInstance | undefined;
  let encerrando = false;

  const encerrarGraciosamente = async (sinal: string) => {
    if (encerrando) {
      return;
    }
    encerrando = true;

    try {
      if (app) {
        app.log.info(`Sinal ${sinal} recebido. Encerrando servidor...`);
        await app.close();
      }
    } catch (erro) {
      if (app) {
        app.log.error({ err: erro }, 'Erro ao fechar o servidor HTTP.');
      } else {
        console.error('Erro ao fechar o servidor HTTP:', erro);
      }
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => void encerrarGraciosamente('SIGINT'));
  process.once('SIGTERM', () => void encerrarGraciosamente('SIGTERM'));

  try {
    app = await buildApp({
      prisma,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
    });
    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (erro) {
    if (app) {
      app.log.error({ err: erro }, 'Falha ao iniciar o servidor HTTP.');
    } else {
      console.error('Falha ao construir ou iniciar o servidor HTTP:', erro);
    }
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
}

if (require.main === module) {
  void iniciarServidor();
}
