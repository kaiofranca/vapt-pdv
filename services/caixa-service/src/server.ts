import { buildApp } from './app';
import { carregarEnv } from './config/env';
import { desconectarPrisma } from './shared/prisma';

async function iniciarServidor(): Promise<void> {
  const config = carregarEnv();
  const app = await buildApp({
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
  });

  const sinaisEncerramento: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const sinal of sinaisEncerramento) {
    process.once(sinal, async () => {
      app.log.info({ sinal }, 'Recebido sinal de encerramento. Fechando caixa-service...');
      try {
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
    await desconectarPrisma();
    process.exit(1);
  }
}

void iniciarServidor();
