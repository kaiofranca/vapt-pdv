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
import { GestaoRepository, PrismaGestaoRepository } from './modules/gestao/gestao.repository';
import { GestaoService } from './modules/gestao/gestao.service';
import { GestaoController } from './modules/gestao/gestao.controller';
import { rotasGestao } from './modules/gestao/rotas';

export interface OpcoesApp {
  prisma?: ClienteBanco;
  repository?: GestaoRepository;
  service?: GestaoService;
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

  // Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VaptPDV Gestão & Analytics Service API',
        description: 'Microsserviço de Gestão Executiva e Analytics/BI OLAP (:3003)',
        version: '0.1.0',
      },
      tags: [
        { name: 'Saúde', description: 'Verificação de conectividade e status' },
        { name: 'Gestão & BI', description: 'Ingestão OLAP, faturamento diário, Curva ABC, desempenho de garçons e relatórios' },
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

  // Inicialização de Dependências
  let prisma: ClienteBanco | undefined = opcoes.prisma;
  if (!prisma && !opcoes.repository) {
    prisma = obterPrisma();
  }

  const repository = opcoes.repository || new PrismaGestaoRepository(prisma!);
  const service = opcoes.service || new GestaoService(repository);
  const controller = new GestaoController(service);

  // Registro de Módulos
  await app.register(rotasSaude, { prisma });
  await app.register(rotasGestao, { controller });

  return app;
}
