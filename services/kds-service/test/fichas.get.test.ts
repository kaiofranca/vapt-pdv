import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('GET /kds/fichas e GET /kds/fila (Story 14.3)', () => {
  function obterBaseFichas() {
    const agora = Date.now();
    return [
      {
        id: 1,
        comandaId: 40,
        itemComandaId: 101,
        mesa: 5,
        garcomId: 1,
        nomeGarcom: 'Garçom A',
        setor: 'cozinha',
        produtoId: 1,
        nomeProduto: 'Pizza Margherita',
        quantidade: 1,
        observacao: null,
        status: 'recebido',
        // 300s atrás (5 min) -> normal (< 480s)
        recebidoEm: new Date(agora - 300 * 1000),
        iniciadoEm: null,
        prontoEm: null,
        entregueEm: null,
      },
      {
        id: 2,
        comandaId: 41,
        itemComandaId: 102,
        mesa: 8,
        garcomId: 2,
        nomeGarcom: 'Garçom B',
        setor: 'cozinha',
        produtoId: 2,
        nomeProduto: 'Hambúrguer Artesanal',
        quantidade: 2,
        observacao: 'Bem passado',
        status: 'em_preparo',
        // 600s atrás (10 min) -> atencao (480..900s)
        recebidoEm: new Date(agora - 600 * 1000),
        iniciadoEm: new Date(agora - 400 * 1000),
        prontoEm: null,
        entregueEm: null,
      },
      {
        id: 3,
        comandaId: 42,
        itemComandaId: 103,
        mesa: 12,
        garcomId: 1,
        nomeGarcom: 'Garçom A',
        setor: 'bar',
        produtoId: 3,
        nomeProduto: 'Chopp Pilsen 500ml',
        quantidade: 3,
        observacao: null,
        status: 'pronto',
        // 1000s atrás (> 16 min) -> atrasado (> 900s)
        recebidoEm: new Date(agora - 1000 * 1000),
        iniciadoEm: new Date(agora - 800 * 1000),
        prontoEm: new Date(agora - 200 * 1000),
        entregueEm: null,
      },
    ];
  }

  function criarMockPrisma(fichas = obterBaseFichas()) {
    return {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {
        findMany: async ({ where, orderBy }: any) => {
          let lista = [...fichas];

          if (where?.setor) {
            lista = lista.filter((f) => f.setor === where.setor);
          }
          if (where?.mesa) {
            lista = lista.filter((f) => f.mesa === where.mesa);
          }
          if (where?.status?.in) {
            lista = lista.filter((f) => where.status.in.includes(f.status));
          }

          if (orderBy?.recebidoEm === 'asc') {
            lista.sort((a, b) => a.recebidoEm.getTime() - b.recebidoEm.getTime());
          }

          return lista;
        },
        groupBy: async ({ where }: any) => {
          let lista = [...fichas];
          if (where?.setor) {
            lista = lista.filter((f) => f.setor === where.setor);
          }

          const counts: Record<string, number> = {};
          for (const item of lista) {
            counts[item.status] = (counts[item.status] || 0) + 1;
          }

          return Object.entries(counts).map(([status, count]) => ({
            status,
            _count: { status: count },
          }));
        },
      },
    };
  }

  it('deve listar fichas em ordem FIFO e calcular corretamente os 3 status de SLA', async () => {
    const mockPrisma = criarMockPrisma();
    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/fichas',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);

    expect(corpo.fichas).toHaveLength(3);
    // Ordenação FIFO: ficha 3 (1000s atrás), ficha 2 (600s atrás), ficha 1 (300s atrás)
    expect(corpo.fichas[0].id).toBe(3);
    expect(corpo.fichas[1].id).toBe(2);
    expect(corpo.fichas[2].id).toBe(1);

    // Validação de SLA
    expect(corpo.fichas[0].sla_status).toBe('atrasado'); // > 900s
    expect(corpo.fichas[1].sla_status).toBe('atencao'); // 480..900s
    expect(corpo.fichas[2].sla_status).toBe('normal'); // < 480s

    // Resumo agregado
    expect(corpo.resumo).toEqual({
      recebido: 1,
      em_preparo: 1,
      pronto: 1,
    });

    await app.close();
  });

  it('deve filtrar por estação/setor (ex.: cozinha) e retornar apenas fichas correspondentes', async () => {
    const mockPrisma = criarMockPrisma();
    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/fichas?estacao=cozinha',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.fichas).toHaveLength(2);
    expect(corpo.fichas.every((f: any) => f.estacao === 'cozinha')).toBe(true);

    await app.close();
  });

  it('deve filtrar por status múltiplos separados por vírgula (ex.: recebido,em_preparo)', async () => {
    const mockPrisma = criarMockPrisma();
    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/fichas?status=recebido,em_preparo',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.fichas).toHaveLength(2);
    expect(corpo.fichas.map((f: any) => f.status)).toEqual(['em_preparo', 'recebido']);

    await app.close();
  });

  it('deve filtrar por mesa específica', async () => {
    const mockPrisma = criarMockPrisma();
    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/fichas?mesa=12',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.fichas).toHaveLength(1);
    expect(corpo.fichas[0].mesa).toBe(12);

    await app.close();
  });

  it('deve responder com sucesso através do alias de compatibilidade /kds/fila', async () => {
    const mockPrisma = criarMockPrisma();
    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'GET',
      url: '/kds/fila',
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.fichas).toBeDefined();
    expect(corpo.resumo).toBeDefined();

    await app.close();
  });
});
