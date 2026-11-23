import { FastifyInstance } from 'fastify';
import { carregarEnv } from './config/env';
import { buildApp } from './app';
import { obterPrisma } from './shared/prisma';
import {
  ProdutosRepositoryPrisma,
  ProdutosService,
} from './modules/produtos';
import {
  CanalAmqp,
  mensageriaHabilitada,
  OutboxPublisher,
  RabbitMQClient,
  registrarConsumidoresCore,
} from './shared/messaging';

export async function iniciarServidor(): Promise<void> {
  const env = carregarEnv();
  const prisma = obterPrisma();
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
    const usarMensageria = mensageriaHabilitada(env.RABBITMQ_URL);

    if (usarMensageria) {
      rabbitClient = new RabbitMQClient(env.RABBITMQ_URL, console);
      await rabbitClient.conectar();

      outboxPublisher = new OutboxPublisher(
        prisma,
        (tipoEvento, payload, messageId) =>
          rabbitClient!.publicarEvento(tipoEvento, payload, messageId),
        console,
      );

      const produtosRepo = new ProdutosRepositoryPrisma(prisma);
      const produtosService = new ProdutosService(
        produtosRepo,
        undefined,
        outboxPublisher,
        true,
      );

      app = await buildApp({
        prisma,
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        outboxPublisher,
        usarMensageria: true,
      });

      outboxPublisher.iniciar();

      const registrarConsumidores = async (canal: CanalAmqp) => {
        await registrarConsumidoresCore(
          canal,
          prisma,
          produtosService,
          outboxPublisher,
          app?.log,
        );
      };

      const canalAtual = rabbitClient.obterCanal();
      if (canalAtual) {
        await registrarConsumidores(canalAtual);
      }
      rabbitClient.registrarCallbackConexao(registrarConsumidores);
    } else {
      app = await buildApp({
        prisma,
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
      });
    }

    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (erro) {
    outboxPublisher?.parar();
    await rabbitClient?.fechar().catch(() => undefined);

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
