import path from 'path';
import fs from 'fs';
import Fastify, { FastifyError, FastifyInstance, FastifyLoggerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
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
import type { ICaixaGateway } from './shared/gateways/caixa.gateway';
import type { IGestaoGateway } from './shared/gateways/gestao.gateway';

export interface OpcoesApp {
  prisma?: ClienteBanco;
  nodeEnv?: AmbienteNode;
  logLevel?: NivelLog;
  logger?: boolean | FastifyLoggerOptions;
  caixaGateway?: ICaixaGateway;
  gestaoGateway?: IGestaoGateway;
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

  // Servir arquivos estáticos do Frontend Web/PWA do PDV Core
  // Dá prioridade aos artefatos de produção compilados do React 19 (frontend/dist/)
  const caminhoDistFrontend = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  const pastaPublica = fs.existsSync(caminhoDistFrontend)
    ? caminhoDistFrontend
    : fs.existsSync(path.join(__dirname, '..', 'public'))
    ? path.join(__dirname, '..', 'public')
    : path.join(process.cwd(), 'public');

  const temIndexHtml =
    fs.existsSync(pastaPublica) &&
    fs.existsSync(path.join(pastaPublica, 'index.html'));

  if (fs.existsSync(pastaPublica)) {
    await app.register(fastifyStatic, {
      root: pastaPublica,
      prefix: '/',
    });

    const rotasSpa = ['/garcom', '/caixa', '/kds', '/gestao', '/login'];
    for (const rota of rotasSpa) {
      app.get(rota, async (_request, reply) => {
        return reply.sendFile('index.html');
      });
    }
  }

  app.setNotFoundHandler((request, reply) => {
    const urlLimpa = request.url.split('?')[0];
    const isApiPrefix =
      urlLimpa.startsWith('/produtos') ||
      urlLimpa.startsWith('/usuarios') ||
      urlLimpa.startsWith('/comandas') ||
      urlLimpa.startsWith('/health') ||
      urlLimpa.startsWith('/docs');

    const aceitaHtml = (request.headers.accept || '').includes('text/html');
    const temExtensaoArquivo = path.extname(urlLimpa).length > 0;

    if (
      request.method === 'GET' &&
      !isApiPrefix &&
      !temExtensaoArquivo &&
      aceitaHtml &&
      temIndexHtml
    ) {
      return reply.sendFile('index.html');
    }

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
  await app.register(moduloComandas, {
    prisma,
    caixaGateway: opcoes.caixaGateway,
    gestaoGateway: opcoes.gestaoGateway,
  });

  return app;
}
