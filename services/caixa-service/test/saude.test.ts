import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';

describe('caixa-service — Verificação de Saúde e Documentação (Story 15.1)', () => {
  it('deve retornar 200 OK com banco conectado quando a consulta tem sucesso', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    } as unknown as ClienteBanco;

    const app = await buildApp({
      prisma: mockPrisma,
      logger: false,
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.status).toBe('ok');
    expect(corpo.servico).toBe('caixa-service');
    expect(corpo.banco).toBe('conectado');
    expect(corpo.timestamp).toBeDefined();

    await app.close();
  });

  it('deve retornar 503 com banco desconectado quando o banco de dados falhar', async () => {
    const mockPrismaComErro = {
      $queryRaw: async () => {
        throw new Error('Connection refused at 5432');
      },
    } as unknown as ClienteBanco;

    const app = await buildApp({
      prisma: mockPrismaComErro,
      logger: false,
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(resposta.statusCode).toBe(503);
    const corpo = resposta.json();
    expect(corpo.status).toBe('erro');
    expect(corpo.servico).toBe('caixa-service');
    expect(corpo.banco).toBe('desconectado');
    expect(corpo.timestamp).toBeDefined();

    await app.close();
  });

  it('deve responder 200 OK para a rota de documentação OpenAPI /docs', async () => {
    const app = await buildApp({
      logger: false,
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');

    await app.close();
  });
});
