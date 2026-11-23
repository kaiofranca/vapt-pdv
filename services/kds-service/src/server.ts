import { FastifyInstance } from 'fastify';
import { carregarEnv } from './config/env';
import { buildApp } from './app';
import { desconectarPrisma, obterPrisma } from './shared/prisma';
import { FichasRepositorio } from './modules/fichas/repositorio';
import { FichasServico } from './modules/fichas/servico';
import {
  mensageriaHabilitada,
  OutboxPublisher,
  RabbitMQClient,
  registrarConsumidorKds,
} from './shared/messaging';

export async function iniciarServidor(): Promise<void> {
  const env = carregarEnv();
  const prisma = obterPrisma(env.DATABASE_URL);
  let app: FastifyInstance | undefined;
  let rabbitClient: RabbitMQClient | undefined;
  let outboxPublisher: OutboxPublisher | undefined;
  let encerrando = false;

  const encerrarGraciosamente = async (sinal: string) => {
    if (encerrando) {
      return;
    }
    encerrando = true;

    try {
      outboxPublisher?.parar();
      await rabbitClient?.fechar().catch(() => undefined);

      if (app) {
        app.log.info(`Sinal ${sinal} recebido. Encerrando kds-service...`);
        await app.close();
      }
    } catch (erro) {
      if (app) {
        app.log.error({ err: erro }, 'Erro ao fechar o servidor HTTP do kds-service.');
      } else {
        console.error('Erro ao fechar o servidor HTTP do kds-service:', erro);
      }
    } finally {
      await desconectarPrisma().catch(() => undefined);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => void encerrarGraciosamente('SIGINT'));
  process.once('SIGTERM', () => void encerrarGraciosamente('SIGTERM'));

  try {
    const loggerMensageria = {
      info: (...args: any[]) => (app?.log as any)?.info?.(...args),
      warn: (...args: any[]) => (app?.log as any)?.warn?.(...args),
      error: (...args: any[]) => (app?.log as any)?.error?.(...args),
      debug: (...args: any[]) => (app?.log as any)?.debug?.(...args),
    };

    if (mensageriaHabilitada(env.RABBITMQ_URL)) {
      rabbitClient = new RabbitMQClient(env.RABBITMQ_URL, loggerMensageria);
      outboxPublisher = new OutboxPublisher(prisma, rabbitClient, {
        logger: loggerMensageria,
      });
    }

    app = await buildApp({
      prisma,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      outboxPublisher,
    });

    if (rabbitClient && outboxPublisher) {
      const fichasRepositorio = new FichasRepositorio(prisma);
      const fichasServico = new FichasServico(fichasRepositorio, outboxPublisher);

      rabbitClient.registrarCallbackConexao(async (canal) => {
        await registrarConsumidorKds(canal, prisma, fichasServico, app?.log);
      });

      try {
        await rabbitClient.conectar();
      } catch (erroRabbit) {
        app.log.warn(
          { err: erroRabbit },
          'RabbitMQ indisponível no boot; reconexão automática agendada.',
        );
        rabbitClient.agendarReconexao();
      }

      outboxPublisher.iniciar();
    }

    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (erro) {
    outboxPublisher?.parar();
    await rabbitClient?.fechar().catch(() => undefined);
    if (app) {
      app.log.error({ err: erro }, 'Falha ao iniciar o kds-service.');
    } else {
      console.error('Falha ao construir ou iniciar o kds-service:', erro);
    }
    await desconectarPrisma().catch(() => undefined);
    process.exit(1);
  }
}

if (require.main === module) {
  void iniciarServidor();
}
