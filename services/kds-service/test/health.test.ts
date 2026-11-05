import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';

describe('GET /health (kds-service)', () => {
  it('deve retornar status 200 com payload estruturado quando o banco responde com sucesso', async () => {
    const mockPrisma: ClienteBanco = {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
    };

    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(resposta.statusCode).toBe(200);

    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('ok');
    expect(corpo.servico).toBe('kds-service');
    expect(corpo.banco).toBe('conectado');
    expect(typeof corpo.timestamp).toBe('string');
    expect(new Date(corpo.timestamp).toISOString()).toBe(corpo.timestamp);

    await app.close();
  });

  it('deve retornar status 503 com envelope padronizado quando o banco falha', async () => {
    const mockPrisma: ClienteBanco = {
      $queryRaw: async () => {
        throw new Error('Connection refused at kds_db');
      },
      $disconnect: async () => {},
    };

    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(resposta.statusCode).toBe(503);

    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro).toBeDefined();
    expect(corpo.erro.codigo).toBe('SERVICO_INDISPONIVEL');
    expect(corpo.erro.mensagem).toContain('kds_db');
    expect(corpo.erro.detalhes).toEqual([
      { campo: 'banco', mensagem: 'Banco de dados kds_db indisponível no momento.' },
    ]);

    await app.close();
  });
});

