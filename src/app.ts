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
import { moduloUsuarios } from './modules/usuarios';
import { moduloProdutos } from './modules/produtos';
import { moduloComandas } from './modules/comandas';

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
    ajv: {
      customOptions: {
        allErrors: true,
        removeAdditional: false,
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VaptPDV API',
        description:
          'VaptPDV - Ponto de Venda para Bares e Lanchonetes.',
        version: '0.1.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(
        formatarRespostaErro(
          'NAO_ENCONTRADO',
          `Rota ${request.method} ${request.url} não encontrada.`,
          {},
        ),
      );
  });

  app.setErrorHandler((erro: FastifyError | ErroDominio | Error, request, reply) => {
    if (erro instanceof ErroDominio) {
      return reply
        .status(erro.statusHttp)
        .send(formatarRespostaErro(erro.codigo, erro.message, erro.detalhes));
    }

    const erroFastify = erro as FastifyError;
    if (
      Array.isArray(erroFastify.validation) ||
      (typeof erroFastify.statusCode === 'number' &&
        erroFastify.statusCode >= 400 &&
        erroFastify.statusCode < 500)
    ) {
      const status =
        erroFastify.statusCode &&
        erroFastify.statusCode >= 400 &&
        erroFastify.statusCode < 500
          ? erroFastify.statusCode
          : 400;
      const detalhes = Array.isArray(erroFastify.validation)
        ? extrairDetalhesValidacao(erroFastify)
        : erroFastify.message
          ? { motivo: erroFastify.message }
          : {};
      return reply
        .status(status)
        .send(
          formatarRespostaErro(
            'VALIDACAO',
            'Dados de entrada inválidos.',
            detalhes,
          ),
        );
    }

    request.log.error(
      { err: erro },
      'Exceção inesperada durante o processamento da requisição.',
    );

    return reply
      .status(500)
      .send(
        formatarRespostaErro(
          'ERRO_INTERNO',
          'Ocorreu um erro interno no servidor.',
          {},
        ),
      );
  });

  const prisma = opcoes.prisma ?? obterPrisma();

  await app.register(rotasSaude, { prisma });
  await app.register(moduloUsuarios, { prisma });
  await app.register(moduloProdutos, { prisma });
  await app.register(moduloComandas);

  return app;
}
