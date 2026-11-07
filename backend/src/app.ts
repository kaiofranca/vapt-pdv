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

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

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

  // Reverse Proxy Interno / API Gateway para os microsserviços satélites (:3001, :3002, :3003)
  const encaminharParaSatelite = async (
    request: any,
    reply: any,
    baseUrl: string,
  ) => {
    const aceitaHtml = (request.headers.accept || '').includes('text/html');
    if (request.method === 'GET' && aceitaHtml && temIndexHtml) {
      return reply.sendFile('index.html');
    }

    const urlDestino = `${baseUrl.replace(/\/+$/, '')}${request.url}`;
    try {
      const headers: Record<string, string> = {
        Accept: (request.headers.accept as string) || 'application/json',
      };
      if (request.headers['content-type']) {
        headers['Content-Type'] = request.headers['content-type'] as string;
      }
      if (request.headers.authorization) {
        headers.Authorization = request.headers.authorization as string;
      }

      const possuiCorpo =
        request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        request.body !== undefined &&
        request.body !== null;

      const resposta = await fetch(urlDestino, {
        method: request.method,
        headers,
        body: possuiCorpo
          ? typeof request.body === 'string'
            ? request.body
            : JSON.stringify(request.body)
          : undefined,
        signal: AbortSignal.timeout(5000),
      });

      const contentType = resposta.headers.get('content-type');
      if (contentType) {
        reply.header('content-type', contentType);
      }
      const contentDisposition = resposta.headers.get('content-disposition');
      if (contentDisposition) {
        reply.header('content-disposition', contentDisposition);
      }

      const buffer = Buffer.from(await resposta.arrayBuffer());
      return reply.status(resposta.status).send(buffer);
    } catch (erro: any) {
      request.log.warn(
        { err: erro, urlDestino },
        'Falha ao encaminhar requisição para serviço satélite.',
      );
      return reply
        .status(503)
        .send(
          formatarRespostaErro(
            'SERVICO_INDISPONIVEL',
            'O microsserviço satélite solicitado está temporariamente indisponível.',
            { destino: urlDestino },
          ),
        );
    }
  };

  const kdsUrl = process.env.KDS_SERVICE_URL || process.env.KDS_API_URL || 'http://localhost:3001';
  const caixaUrl = process.env.CAIXA_SERVICE_URL || process.env.CAIXA_API_URL || 'http://localhost:3002';
  const gestaoUrl = process.env.GESTAO_SERVICE_URL || process.env.GESTAO_API_URL || 'http://localhost:3003';

  app.all('/kds/*', async (request, reply) => encaminharParaSatelite(request, reply, kdsUrl));
  app.all('/caixa/*', async (request, reply) => encaminharParaSatelite(request, reply, caixaUrl));
  app.all('/gestao/*', async (request, reply) => encaminharParaSatelite(request, reply, gestaoUrl));
  app.all('/analytics/*', async (request, reply) => encaminharParaSatelite(request, reply, gestaoUrl));

  await app.register(rotasSaude, { prisma });
  await app.register(moduloUsuarios, { prisma });
  await app.register(moduloProdutos, { prisma, gestaoGateway: opcoes.gestaoGateway });
  await app.register(moduloComandas, {
    prisma,
    caixaGateway: opcoes.caixaGateway,
    gestaoGateway: opcoes.gestaoGateway,
  });

  return app;
}
