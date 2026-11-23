import { buildApp } from './app';
import { carregarEnv } from './config/env';
import {
  CobrancasService,
  HttpEstoqueCoreGateway,
  HttpGestaoGateway,
  PrismaCobrancasRepository,
} from './modules/caixa';
import {
  OutboxPublisher,
  RabbitMQClient,
  mensageriaHabilitada,
  registrarConsumidorCaixa,
} from './shared/messaging';
import { ClienteBanco, desconectarPrisma, obterPrisma } from './shared/prisma';

async function iniciarServidor(): Promise<void> {
  const config = carregarEnv();
  const habilitarMensageria = mensageriaHabilitada(config.RABBITMQ_URL);

  let prisma: ClienteBanco | undefined;
  let repository: PrismaCobrancasRepository | undefined;
  let rabbitClient: RabbitMQClient | undefined;
  let outboxPublisher: OutboxPublisher | undefined;
  let service: CobrancasService | undefined;

  if (habilitarMensageria) {
    prisma = obterPrisma(config.DATABASE_URL);
    repository = new PrismaCobrancasRepository(prisma);
    const estoqueGateway = new HttpEstoqueCoreGateway(config.CORE_API_URL);
    const gestaoGateway = new HttpGestaoGateway(config.GESTAO_API_URL);

    rabbitClient = new RabbitMQClient(config.RABBITMQ_URL);
    outboxPublisher = new OutboxPublisher(prisma, rabbitClient);
    service = new CobrancasService(
      repository,
      estoqueGateway,
      gestaoGateway,
      outboxPublisher,
      true,
    );
  }

  const app = await buildApp({
    prisma,
    repository,
    service,
    outboxPublisher,
    usarMensageria: habilitarMensageria,
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
  });

  if (habilitarMensageria && rabbitClient && outboxPublisher && prisma && service) {
    rabbitClient.definirLogger(app.log);
    outboxPublisher.definirLogger(app.log);

    rabbitClient.registrarCallbackConexao(async (canal) => {
      await registrarConsumidorCaixa(canal, prisma, service, app.log);
    });

    try {
      await rabbitClient.conectar();
    } catch (erro) {
      app.log.warn(
        erro,
        'Falha inicial ao conectar ao RabbitMQ. Reconexão em background agendada.',
      );
      rabbitClient.agendarReconexao();
    }

    outboxPublisher.iniciar();
  }

  const encerrarRecursosMensageria = async () => {
    if (outboxPublisher) {
      outboxPublisher.parar();
    }
    if (rabbitClient) {
      await rabbitClient.fechar();
    }
  };

  const sinaisEncerramento: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const sinal of sinaisEncerramento) {
    process.once(sinal, async () => {
      app.log.info({ sinal }, 'Recebido sinal de encerramento. Fechando caixa-service...');
      try {
        await encerrarRecursosMensageria();
        await app.close();
        await desconectarPrisma();
        app.log.info('caixa-service encerrado com sucesso.');
        process.exit(0);
      } catch (erro) {
        app.log.error(erro, 'Erro ao encerrar caixa-service.');
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    app.log.info(
      `💳 caixa-service escutando em http://localhost:${config.PORT} (docs: http://localhost:${config.PORT}/docs)`,
    );
  } catch (erro) {
    app.log.error(erro, 'Falha ao iniciar caixa-service.');
    await encerrarRecursosMensageria();
    await desconectarPrisma();
    process.exit(1);
  }
}

void iniciarServidor();
