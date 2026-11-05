import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('GET /kds/comandas/:comandaId/pendencias e alias (Story 14.5)', () => {
  function criarMockPrisma(fichasPorComanda: Record<number, any[]> = {}) {
    return {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {
        findMany: async ({ where }: any) => {
          return fichasPorComanda[where.comandaId] || [];
        },
      },
    };
  }

  it('deve retornar possui_pendencias: true quando houver itens em "recebido" ou "em_preparo"', async () => {
    const mockPrisma = criarMockPrisma({
      42: [
        {
          id: 1,
          comandaId: 42,
          itemComandaId: 101,
          mesa: 12,
          garcomId: 1,
          nomeGarcom: 'Garçom A',
          setor: 'cozinha',
          produtoId: 7,
          nomeProduto: 'Hambúrguer',
          quantidade: 2,
          observacao: null,
          status: 'em_preparo',
          recebidoEm: new Date(),
          iniciadoEm: new Date(),
          prontoEm: null,
          entregueEm: null,
        },
        {
          id: 2,
          comandaId: 42,
          itemComandaId: 102,
          mesa: 12,
          garcomId: 1,
          nomeGarcom: 'Garçom A',
          setor: 'bar',
          produtoId: 8,
          nomeProduto: 'Chopp',
          quantidade: 1,
          observacao: null,
          status: 'entregue',
          recebidoEm: new Date(),
          iniciadoEm: null,
          prontoEm: null,
          entregueEm: new Date(),
        },
      ],
    });

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/comandas/42/pendencias',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.comanda_id).toBe(42);
    expect(corpo.mesa).toBe(12);
    expect(corpo.possui_pendencias).toBe(true);
    expect(corpo.totais).toEqual({
      recebido: 0,
      em_preparo: 1,
      pronto: 0,
      entregue: 1,
      cancelado: 0,
    });
    expect(corpo.itens).toHaveLength(2);
    expect(corpo.itens[0]).toEqual({
      ficha_id: 1,
      item_comanda_id: 101,
      nome_produto: 'Hambúrguer',
      quantidade: 2,
      estacao: 'cozinha',
      status: 'em_preparo',
    });

    await app.close();
  });

  it('deve retornar possui_pendencias: false quando todos os itens estiverem entregues ou cancelados', async () => {
    const mockPrisma = criarMockPrisma({
      50: [
        {
          id: 3,
          comandaId: 50,
          itemComandaId: 103,
          mesa: 5,
          garcomId: 2,
          nomeGarcom: 'Garçom B',
          setor: 'cozinha',
          produtoId: 9,
          nomeProduto: 'Batata Frita',
          quantidade: 1,
          observacao: null,
          status: 'entregue',
          recebidoEm: new Date(),
          iniciadoEm: null,
          prontoEm: null,
          entregueEm: new Date(),
        },
        {
          id: 4,
          comandaId: 50,
          itemComandaId: 104,
          mesa: 5,
          garcomId: 2,
          nomeGarcom: 'Garçom B',
          setor: 'bar',
          produtoId: 10,
          nomeProduto: 'Refrigerante',
          quantidade: 1,
          observacao: null,
          status: 'cancelado',
          recebidoEm: new Date(),
          iniciadoEm: null,
          prontoEm: null,
          entregueEm: null,
        },
      ],
    });

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/comandas/50/pendencias',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.possui_pendencias).toBe(false);
    expect(corpo.totais.entregue).toBe(1);
    expect(corpo.totais.cancelado).toBe(1);

    await app.close();
  });

  it('deve responder 200 OK com totais zerados quando a comanda não possui nenhuma ficha no KDS', async () => {
    const mockPrisma = criarMockPrisma({});
    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/comandas/99/pendencias',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.comanda_id).toBe(99);
    expect(corpo.possui_pendencias).toBe(false);
    expect(corpo.totais).toEqual({
      recebido: 0,
      em_preparo: 0,
      pronto: 0,
      entregue: 0,
      cancelado: 0,
    });
    expect(corpo.itens).toEqual([]);

    await app.close();
  });

  it('deve responder através do alias /status-preparo', async () => {
    const mockPrisma = criarMockPrisma({});
    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/comandas/42/status-preparo',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.comanda_id).toBe(42);

    await app.close();
  });

  it('deve retornar 400 VALIDACAO para comandaId menor ou igual a zero', async () => {
    const mockPrisma = criarMockPrisma({});
    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/comandas/0/pendencias',
    });

    expect(resposta.statusCode).toBe(400);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro.codigo).toBe('VALIDACAO');

    await app.close();
  });
});

