import Fastify, { FastifyError, FastifyInstance, FastifyLoggerOptions } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AmbienteNode, NivelLog } from './config/env';
import { ErroDominio } from './shared/erros';
import { ClienteBanco, obterPrisma } from './shared/prisma';
import { rotasSaude } from './modules/saude/rotas';
import { rotasFichas } from './modules/fichas/rotas';

export interface OpcoesApp {
  prisma?: ClienteBanco;
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
  }).withTypeProvider<TypeBoxTypeProvider>();

  const prisma = opcoes.prisma ?? obterPrisma();

  // Tratamento global de erros padronizado
  app.setErrorHandler((error: FastifyError | ErroDominio, request, reply) => {
    if (error instanceof ErroDominio) {
      return reply.status(error.statusCode).send({
        erro: {
          codigo: error.codigo,
          mensagem: error.message,
          detalhes: error.detalhes,
        },
      });
    }

    if ('validation' in error && error.validation) {
      const detalhes = error.validation.map((v) => ({
        campo: v.instancePath || (v.params && (v.params as any).missingProperty) || 'desconhecido',
        mensagem: v.message || 'Dado inválido',
      }));

      return reply.status(400).send({
        erro: {
          codigo: 'VALIDACAO',
          mensagem: 'Erro de validação dos dados enviados.',
          detalhes,
        },
      });
    }

    request.log.error({ err: error }, 'Erro interno não tratado no kds-service.');

    return reply.status(500).send({
      erro: {
        codigo: 'ERRO_INTERNO',
        mensagem: 'Ocorreu um erro interno no servidor.',
      },
    });
  });

  // Registro de rotas
  await app.register(rotasSaude, { prisma });
  await app.register(rotasFichas, { prisma });

  return app as unknown as FastifyInstance;
}

