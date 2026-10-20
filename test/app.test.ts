import { describe, expect, it, vi } from 'vitest';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { PrismaClient } from '@prisma/client';
import { buildApp, criarOpcoesLogger } from '../src/app';
import { carregarEnv, validarEnv } from '../src/config/env';
import { ClienteBanco } from '../src/shared/prisma';

function criarPrismaMock(implementacao?: () => Promise<unknown>): ClienteBanco {
  return {
    $queryRaw: vi.fn(implementacao ?? (async () => [{ '?column?': 1 }])),
    $disconnect: vi.fn(async () => undefined),
  };
}

describe('Infraestrutura Base e Esqueleto da API (Story 1)', () => {
  it('Saúde ok: GET /health retorna 200 {"status":"ok"} quando o banco está acessível', async () => {
    const prisma = criarPrismaMock();
    const app = await buildApp({ prisma, logger: false });

    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('Banco fora: GET /health retorna 503 SERVICO_INDISPONIVEL com detalhes.servico = "banco", loga o erro e mantém o processo vivo', async () => {
    let falharBanco = true;
    const prisma = criarPrismaMock(async () => {
      if (falharBanco) {
        throw new Error('Connection refused: localhost:5432');
      }
      return [{ '?column?': 1 }];
    });

    const logsErro: string[] = [];
    const streamLog = {
      write(chunk: string) {
        logsErro.push(chunk);
      },
    };

    const app = await buildApp({
      prisma,
      logger: {
        level: 'error',
        stream: streamLog,
      } as Record<string, unknown>,
    });

    const respostaFalha = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(respostaFalha.statusCode).toBe(503);
    expect(respostaFalha.json()).toEqual({
      erro: {
        codigo: 'SERVICO_INDISPONIVEL',
        mensagem: 'Banco de dados indisponível no momento.',
        detalhes: {
          servico: 'banco',
        },
      },
    });
    expect(logsErro.some((linha) => linha.includes('Connection refused'))).toBe(true);

    // O processo segue vivo e responde normalmente na chamada seguinte quando o banco volta
    falharBanco = false;
    const respostaRecuperada = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(respostaRecuperada.statusCode).toBe(200);
    expect(respostaRecuperada.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('Rota inexistente: GET /nada retorna 404 NAO_ENCONTRADO no formato padrão', async () => {
    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });

    const resposta = await app.inject({
      method: 'GET',
      url: '/nada',
    });

    expect(resposta.statusCode).toBe(404);
    const corpo = resposta.json();
    expect(corpo).toEqual({
      erro: {
        codigo: 'NAO_ENCONTRADO',
        mensagem: expect.stringContaining('/nada'),
        detalhes: {},
      },
    });

    await app.close();
  });

  it('Corpo inválido: rota com schema recebendo campo faltando retorna 400 VALIDACAO com detalhes por campo', async () => {
    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });

    app.withTypeProvider<TypeBoxTypeProvider>().post(
      '/_teste-validacao',
      {
        schema: {
          body: Type.Object({
            nome: Type.String({ minLength: 1 }),
            mesa: Type.Integer({ minimum: 1 }),
          }),
        },
      },
      async (request) => request.body,
    );

    const resposta = await app.inject({
      method: 'POST',
      url: '/_teste-validacao',
      payload: {
        mesa: 0,
      },
    });

    expect(resposta.statusCode).toBe(400);
    const corpo = resposta.json();
    expect(corpo.erro.codigo).toBe('VALIDACAO');
    expect(typeof corpo.erro.mensagem).toBe('string');
    expect(corpo.erro.detalhes).toHaveProperty('nome');
    expect(corpo.erro.detalhes).toHaveProperty('mesa');

    await app.close();
  });

  it('Exceção inesperada: handler que lança erro retorna 500 ERRO_INTERNO sem stack na resposta e registra stack apenas no log', async () => {
    const logsErro: string[] = [];
    const streamLog = {
      write(chunk: string) {
        logsErro.push(chunk);
      },
    };

    const app = await buildApp({
      prisma: criarPrismaMock(),
      logger: {
        level: 'error',
        stream: streamLog,
      } as Record<string, unknown>,
    });

    app.get('/_teste-excecao', async () => {
      throw new Error('Falha catastrófica com segredo: postgres://admin:supersecreto@db/prod');
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/_teste-excecao',
    });

    expect(resposta.statusCode).toBe(500);
    const textoResposta = resposta.body;
    const corpo = resposta.json();

    expect(corpo).toEqual({
      erro: {
        codigo: 'ERRO_INTERNO',
        mensagem: 'Ocorreu um erro interno no servidor.',
        detalhes: {},
      },
    });
    expect(textoResposta).not.toContain('stack');
    expect(textoResposta).not.toContain('supersecreto');

    // Stack registrado somente no log estruturado
    const logCompleto = logsErro.join('\n');
    expect(logCompleto).toContain('stack');
    expect(logCompleto).toContain('Falha catastrófica');

    await app.close();
  });

  it('Env ausente: subida sem DATABASE_URL encerra o processo com mensagem clara em pt-br e código de saída != 0', () => {
    const spyErro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let codigoSaida: number | undefined;

    const encerrarFalso = ((codigo: number) => {
      codigoSaida = codigo;
      throw new Error(`PROCESS_EXIT_${codigo}`);
    }) as (codigo: number) => never;

    expect(() =>
      carregarEnv(
        {
          NODE_ENV: 'production',
          PORT: '3000',
          LOG_LEVEL: 'info',
        },
        encerrarFalso,
      ),
    ).toThrow('PROCESS_EXIT_1');

    expect(codigoSaida).toBe(1);
    expect(spyErro).toHaveBeenCalledWith(
      expect.stringContaining('Variável de ambiente obrigatória ausente: DATABASE_URL'),
    );

    spyErro.mockRestore();
  });

  it('Validação de env: aceita configuração válida, valores explícitos e rejeita PORT, NODE_ENV e LOG_LEVEL inválidos', () => {
    const envPadrao = validarEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    });

    expect(envPadrao).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: 3000,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    });

    const envExplicito = validarEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '8080',
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    });

    expect(envExplicito).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: 8080,
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
    });

    for (const portaInvalida of ['0', '70000', 'abc']) {
      expect(() =>
        validarEnv({
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          PORT: portaInvalida,
        }),
      ).toThrow(/PORT/);
    }

    expect(() =>
      validarEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'staging',
      }),
    ).toThrow(/NODE_ENV/);

    expect(() =>
      validarEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        LOG_LEVEL: 'verbose',
      }),
    ).toThrow(/LOG_LEVEL/);
  });

  it('Logs estruturados: não utiliza pino-pretty em produção', () => {
    const configProd = criarOpcoesLogger('production', 'info');
    expect(configProd).toEqual({ level: 'info' });
    expect(configProd).not.toHaveProperty('transport');
  });

  it('Documentação: GET /docs serve o Swagger UI e lista a rota /health na especificação OpenAPI', async () => {
    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });

    const respostaUi = await app.inject({
      method: 'GET',
      url: '/docs',
    });

    expect([200, 302]).toContain(respostaUi.statusCode);
    const htmlUi =
      respostaUi.statusCode === 302
        ? (
            await app.inject({
              method: 'GET',
              url: respostaUi.headers.location as string,
            })
          ).body
        : respostaUi.body;
    expect(htmlUi.toLowerCase()).toContain('swagger');

    const respostaOpenApi = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(respostaOpenApi.statusCode).toBe(200);
    const spec = respostaOpenApi.json();
    expect(spec.paths).toHaveProperty('/health');
    expect(spec.paths['/health']).toHaveProperty('get');

    await app.close();
  });

  it('Integração Prisma real com banco indisponível: GET /health retorna 503 padronizado e o processo continua respondendo em /docs', async () => {
    const prismaIndisponivel = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://usuario:senha@127.0.0.1:54399/banco_inexistente?connect_timeout=1',
        },
      },
    });

    const app = await buildApp({
      prisma: prismaIndisponivel,
      logger: false,
    });

    const respostaSaude = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(respostaSaude.statusCode).toBe(503);
    expect(respostaSaude.json()).toEqual({
      erro: {
        codigo: 'SERVICO_INDISPONIVEL',
        mensagem: 'Banco de dados indisponível no momento.',
        detalhes: {
          servico: 'banco',
        },
      },
    });

    const respostaDocs = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(respostaDocs.statusCode).toBe(200);

    await app.close();
    await prismaIndisponivel.$disconnect();
  });
});
