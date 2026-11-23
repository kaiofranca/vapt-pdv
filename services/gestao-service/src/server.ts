import { buildApp } from './app';
import { carregarEnv } from './config/env';
import { desconectarPrisma, obterPrisma } from './shared/prisma';
import { PrismaGestaoRepository } from './modules/gestao/gestao.repository';
import { GestaoService } from './modules/gestao/gestao.service';
import {
  RabbitMQClient,
  mensageriaHabilitada,
  registrarConsumidorGestao,
} from './shared/messaging';

async function iniciarServidor(): Promise<void> {
  const config = carregarEnv();
  const prisma = obterPrisma();
  const repository = new PrismaGestaoRepository(prisma);
  const service = new GestaoService(repository);

  const app = await buildApp({
    prisma,
    repository,
    service,
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
  });

  let rabbitClient: RabbitMQClient | null = null;
  if (mensageriaHabilitada(config.RABBITMQ_URL)) {
    rabbitClient = new RabbitMQClient({
      url: config.RABBITMQ_URL,
      logger: app.log,
    });
    rabbitClient.registrarCallbackConexao(async (canal) => {
      await registrarConsumidorGestao(canal, service, app.log);
    });
  }

  const sinaisEncerramento: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const sinal of sinaisEncerramento) {
    process.once(sinal, async () => {
      app.log.info({ sinal }, 'Recebido sinal de encerramento. Fechando gestao-service...');
      try {
        if (rabbitClient) {
          await rabbitClient.fechar();
        }
        await app.close();
        await desconectarPrisma();
        app.log.info('gestao-service encerrado com sucesso.');
        process.exit(0);
      } catch (erro) {
        app.log.error(erro, 'Erro ao encerrar gestao-service.');
        process.exit(1);
      }
    });
  }

  try {
    if (rabbitClient) {
      try {
        await rabbitClient.conectar();
        app.log.info('Consumidor RabbitMQ (gestao.eventos) registrado com sucesso.');
      } catch (erro) {
        app.log.error(
          erro,
          'Falha inicial ao conectar ao RabbitMQ; reconexão automática será tentada em segundo plano.',
        );
        rabbitClient.agendarReconexao();
      }
    }

    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    app.log.info(
      `📊 gestao-service escutando em http://localhost:${config.PORT} (docs: http://localhost:${config.PORT}/docs)`,
    );
  } catch (erro) {
    app.log.error(erro, 'Falha ao iniciar gestao-service.');
    if (rabbitClient) {
      await rabbitClient.fechar();
    }
    await desconectarPrisma();
    process.exit(1);
  }
}

void iniciarServidor();
