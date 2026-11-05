import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('POST /kds/fichas (Story 14.2)', () => {
  it('deve registrar nova ficha com sucesso e retornar 201 Created', async () => {
    const fichasDb = new Map<number, any>();
    let idCounter = 1;

    const mockPrisma: any = {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {
        findUnique: async ({ where }: any) => {
          if (where.itemComandaId) {
            for (const f of fichasDb.values()) {
              if (f.itemComandaId === where.itemComandaId) return f;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const novoId = idCounter++;
          const reg = {
            id: novoId,
            comandaId: data.comandaId,
            itemComandaId: data.itemComandaId,
            mesa: data.mesa,
            garcomId: data.garcomId,
            nomeGarcom: data.nomeGarcom,
            setor: data.setor,
            produtoId: data.produtoId,
            nomeProduto: data.nomeProduto,
            quantidade: data.quantidade,
            observacao: data.observacao,
            status: data.status,
            recebidoEm: new Date('2026-04-11T19:05:01.000Z'),
            iniciadoEm: null,
            prontoEm: null,
            entregueEm: null,
          };
          fichasDb.set(novoId, reg);
          return reg;
        },
      },
    };

    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'POST',
      url: '/kds/fichas',
      payload: {
        comanda_id: 42,
        item_comanda_id: 101,
        produto_id: 7,
        mesa: 12,
        garcom_id: 1,
        garcom_nome: 'Carlos Garçom',
        nome_produto: 'Hambúrguer Artesanal',
        estacao: 'cozinha',
        quantidade: 2,
        observacao: 'Sem cebola',
      },
    });

    expect(resposta.statusCode).toBe(201);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.id).toBe(1);
    expect(corpo.comanda_id).toBe(42);
    expect(corpo.item_comanda_id).toBe(101);
    expect(corpo.mesa).toBe(12);
    expect(corpo.garcom_nome).toBe('Carlos Garçom');
    expect(corpo.nome_produto).toBe('Hambúrguer Artesanal');
    expect(corpo.estacao).toBe('cozinha');
    expect(corpo.quantidade).toBe(2);
    expect(corpo.observacao).toBe('Sem cebola');
    expect(corpo.status).toBe('recebido');
    expect(corpo.recebido_em).toBe('2026-04-11T19:05:01.000Z');

    await app.close();
  });

  it('deve retornar 200 OK com registro existente quando item_comanda_id já foi recebido (idempotência)', async () => {
    const registroExistente = {
      id: 1,
      comandaId: 42,
      itemComandaId: 101,
      mesa: 12,
      garcomId: 1,
      nomeGarcom: 'Carlos Garçom',
      setor: 'cozinha',
      produtoId: 7,
      nomeProduto: 'Hambúrguer Artesanal',
      quantidade: 2,
      observacao: 'Sem cebola',
      status: 'recebido',
      recebidoEm: new Date('2026-04-11T19:05:01.000Z'),
      iniciadoEm: null,
      prontoEm: null,
      entregueEm: null,
    };

    const mockPrisma: any = {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {
        findUnique: async ({ where }: any) => {
          if (where.itemComandaId === 101) return registroExistente;
          return null;
        },
        create: async () => {
          const erro: any = new Error('Unique constraint failed on the fields: (`item_comanda_id`)');
          erro.code = 'P2002';
          throw erro;
        },
      },
    };

    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'POST',
      url: '/kds/fichas',
      payload: {
        comanda_id: 42,
        item_comanda_id: 101,
        produto_id: 7,
        mesa: 12,
        garcom_id: 1,
        garcom_nome: 'Carlos Garçom',
        nome_produto: 'Hambúrguer Artesanal',
        estacao: 'cozinha',
        quantidade: 2,
        observacao: 'Sem cebola',
      },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.id).toBe(1);
    expect(corpo.item_comanda_id).toBe(101);
    expect(corpo.status).toBe('recebido');

    await app.close();
  });

  it('deve retornar 400 VALIDACAO quando quantidade ou mesa forem inválidas', async () => {
    const mockPrisma: any = {
      $queryRaw: async () => [{ '?column?': 1 }],
      $disconnect: async () => {},
      fichaPreparo: {},
    };

    const app = await buildApp({
      prisma: mockPrisma,
      nodeEnv: 'test',
      logLevel: 'silent',
    });

    const resposta = await app.inject({
      method: 'POST',
      url: '/kds/fichas',
      payload: {
        comanda_id: 42,
        item_comanda_id: 102,
        produto_id: 7,
        mesa: 0, // inválido (mesa deve ser > 0)
        garcom_id: 1,
        nome_produto: 'Hambúrguer Artesanal',
        quantidade: -1, // inválido
      },
    });

    expect(resposta.statusCode).toBe(400);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.erro).toBeDefined();
    expect(corpo.erro.codigo).toBe('VALIDACAO');

    await app.close();
  });
});

