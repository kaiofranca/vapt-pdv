import Fastify, { FastifyError, FastifyInstance, FastifyLoggerOptions } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AmbienteNode, NivelLog } from './config/env';
import {
  ErroDominio,
  extrairDetalhesValidacao,
  formatarRespostaErro,
} from './shared/erros';
import { ClienteBanco, obterPrisma } from './shared/prisma';
import { rotasSaude } from './modules/saude/rotas';
import {
  CobrancasRepository,
  PrismaCobrancasRepository,
  CobrancasService,
  EstoqueCoreGateway,
  GestaoGateway,
  HttpEstoqueCoreGateway,
  HttpGestaoGateway,
  rotasCaixa,
} from './modules/caixa';

export interface OpcoesApp {
  prisma?: ClienteBanco;
  repository?: CobrancasRepository;
  service?: CobrancasService;
  estoqueGateway?: EstoqueCoreGateway;
  gestaoGateway?: GestaoGateway;
  nodeEnv?: AmbienteNode;
  logLevel?: NivelLog;
  logger?: boolean | FastifyLoggerOptions;
}

export function criarOpcoesLogger(
  nodeEnv: AmbienteNode = 'development',
  logLevel: NivelLog = 'info',
): FastifyLoggerOptions | Record<string, unknown> {
  if (nodeEnv !== 'development') {
    return {
      level: logLevel,
    };
  }

  return {
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  };
}

export async function buildApp(opcoes: OpcoesApp = {}): Promise<FastifyInstance> {
  const nodeEnv =
    opcoes.nodeEnv ??
    ((process.env.NODE_ENV as AmbienteNode | undefined) || 'development');
  const logLevel =
    opcoes.logLevel ?? ((process.env.LOG_LEVEL as NivelLog | undefined) || 'info');

  const loggerConfig =
    opcoes.logger !== undefined ? opcoes.logger : criarOpcoesLogger(nodeEnv, logLevel);

  const app = Fastify({
    logger: loggerConfig,
    ajv: {
      customOptions: {
        allErrors: true,
        removeAdditional: false,
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Documentação OpenAPI / Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VaptPDV Caixa Service API',
        description:
          'Microsserviço de Frente de Caixa, Split Payment, Troco e Recibo Térmico (:3002)',
        version: '0.1.0',
      },
      tags: [
        { name: 'Saúde', description: 'Verificação de conectividade e status' },
        {
          name: 'Caixa & Pagamentos',
          description:
            'Fila de recebimento, divisão de conta (Split Payment), quitação e emissão de recibo operacional',
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Handler Global de Erros Padronizado (RFC 7807)
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ErroDominio) {
      return reply
        .status(error.statusHttp)
        .send(formatarRespostaErro(error.codigo, error.message, error.detalhes));
    }

    if (error.validation) {
      const detalhes = extrairDetalhesValidacao(error);
      return reply
        .status(400)
        .send(formatarRespostaErro('VALIDACAO', 'Falha na validação da requisição.', detalhes));
    }

    app.log.error(error);
    return reply
      .status(500)
      .send(formatarRespostaErro('ERRO_INTERNO', 'Ocorreu um erro interno no servidor.'));
  });

  // Inicialização do Banco e Repositórios
  let prisma: ClienteBanco | undefined = opcoes.prisma;
  if (!prisma && !opcoes.repository && !opcoes.service && process.env.NODE_ENV !== 'test') {
    prisma = obterPrisma();
  }

  const repository =
    opcoes.repository || (prisma ? new PrismaCobrancasRepository(prisma) : undefined);
  const estoqueGateway =
    opcoes.estoqueGateway ||
    new HttpEstoqueCoreGateway(process.env.CORE_API_URL || 'http://localhost:3000');
  const gestaoGateway =
    opcoes.gestaoGateway ||
    new HttpGestaoGateway(
      process.env.GESTAO_API_URL || 'http://localhost:3003',
      app.log,
    );
  const service =
    opcoes.service ||
    (repository
      ? new CobrancasService(repository, estoqueGateway, gestaoGateway)
      : undefined);

  // Registro de Módulos
  await app.register(rotasSaude, { prisma });

  if (service) {
    await app.register(rotasCaixa, { service });
  }

  return app;
}
