import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('PATCH /kds/fichas/:id/status (Story 14.4)', () => {
  function criarMockPrisma(fichasIniciais: any[] = []) {
    const mapa = new Map<number, any>(fichasIniciais.map((f) => [f.id, { ...f }]));

    return {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {
        findUnique: async ({ where }: any) => {
          return mapa.get(where.id) ? { ...mapa.get(where.id) } : null;
        },
        update: async ({ where, data }: any) => {
          const item = mapa.get(where.id);
          if (!item) throw new Error('Not found');
          const atualizado = { ...item, ...data };
          mapa.set(where.id, atualizado);
          return atualizado;
        },
      },
    };
  }

  it('deve transicionar de "recebido" para "em_preparo" carimbando iniciado_em', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 1,
        comandaId: 10,
        itemComandaId: 101,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'recebido',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: null,
        prontoEm: null,
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/1/status',
      payload: { status: 'em_preparo', alterado_por: 'Cozinheiro João' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('em_preparo');
    expect(corpo.iniciado_em).toBeDefined();
    expect(corpo.pronto_em).toBeNull();
    expect(corpo.entregue_em).toBeNull();

    await app.close();
  });

  it('deve transicionar de "em_preparo" para "pronto" carimbando pronto_em', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 2,
        comandaId: 10,
        itemComandaId: 102,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'em_preparo',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: new Date('2026-04-11T19:05:00.000Z'),
        prontoEm: null,
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/2/status',
      payload: { status: 'pronto' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('pronto');
    expect(corpo.pronto_em).toBeDefined();
    expect(corpo.entregue_em).toBeNull();

    await app.close();
  });

  it('deve transicionar de "pronto" para "entregue" carimbando entregue_em', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 3,
        comandaId: 10,
        itemComandaId: 103,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'pronto',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: new Date('2026-04-11T19:05:00.000Z'),
        prontoEm: new Date('2026-04-11T19:15:00.000Z'),
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/3/status',
      payload: { status: 'entregue' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('entregue');
    expect(corpo.entregue_em).toBeDefined();

    await app.close();
  });

  it('deve permitir cancelar ficha em aberto antes da entrega', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 4,
        comandaId: 10,
        itemComandaId: 104,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'recebido',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: null,
        prontoEm: null,
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/4/status',
      payload: { status: 'cancelado' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('cancelado');

    await app.close();
  });

  it('deve retornar 200 idempotente ao tentar transicionar para o mesmo status', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 5,
        comandaId: 10,
        itemComandaId: 105,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'pronto',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: new Date('2026-04-11T19:05:00.000Z'),
        prontoEm: new Date('2026-04-11T19:15:00.000Z'),
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/5/status',
      payload: { status: 'pronto' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('pronto');

    await app.close();
  });

  it('deve recusar com 422 TRANSICAO_KDS_INVALIDA transição sobre ficha entregue', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 6,
        comandaId: 10,
        itemComandaId: 106,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'entregue',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: new Date('2026-04-11T19:05:00.000Z'),
        prontoEm: new Date('2026-04-11T19:15:00.000Z'),
        entregueEm: new Date('2026-04-11T19:20:00.000Z'),
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/6/status',
      payload: { status: 'em_preparo' },
    });

    expect(resposta.statusCode).toBe(422);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro.codigo).toBe('TRANSICAO_KDS_INVALIDA');

    await app.close();
  });

  it('deve recusar com 422 pular etapas na máquina de estados (ex.: recebido -> entregue)', async () => {
    const mockPrisma = criarMockPrisma([
      {
        id: 7,
        comandaId: 10,
        itemComandaId: 107,
        mesa: 2,
        garcomId: 1,
        nomeGarcom: 'Garçom',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Pizza',
        quantidade: 1,
        observacao: null,
        status: 'recebido',
        recebidoEm: new Date('2026-04-11T19:00:00.000Z'),
        iniciadoEm: null,
        prontoEm: null,
        entregueEm: null,
      },
    ]);

    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/7/status',
      payload: { status: 'entregue' },
    });

    expect(resposta.statusCode).toBe(422);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro.codigo).toBe('TRANSICAO_KDS_INVALIDA');

    await app.close();
  });

  it('deve retornar 404 NAO_ENCONTRADO para ficha inexistente', async () => {
    const mockPrisma = criarMockPrisma([]);
    const app = await buildApp({ prisma: mockPrisma, nodeEnv: 'test', logLevel: 'silent' });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/999/status',
      payload: { status: 'pronto' },
    });

    expect(resposta.statusCode).toBe(404);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');

    await app.close();
  });
});

