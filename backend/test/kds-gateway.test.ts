import { describe, expect, it, vi } from 'vitest';
import { FakeKdsGateway, HttpKdsGateway } from '../src/shared/gateways/kds.gateway';
import type { IGestaoGateway } from '../src/shared/gateways/gestao.gateway';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { Prisma } from '@prisma/client';

describe('Story 2.1.5 — Core: Integração via KdsGateway com Resiliência e Timeout (ADR-01, ADR-07)', () => {
  it('EARS-KDSGW-01/02: FakeKdsGateway despacha ficha de preparo estruturada com sucesso', async () => {
    const gateway = new FakeKdsGateway();

    const resultado = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 25,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_garcom: 'Carlos',
      nome_produto: 'Hambúrguer Artesanal',
      setor: 'cozinha',
      quantidade: 2,
      observacao: 'Sem cebola',
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.fichaId).toBe(1);
    expect(gateway.fichasDespachadas).toHaveLength(1);
    expect(gateway.fichasDespachadas[0].observacao).toBe('Sem cebola');
    expect(gateway.fichasDespachadas[0].mesa).toBe(7);
  });

  it('EARS-KDSGW-07: Resiliência contra timeout e conexão recusada (ADR-07)', async () => {
    const gateway = new FakeKdsGateway();
    gateway.simularTimeout = true;

    const resTimeout = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 26,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_produto: 'Pizza',
      quantidade: 1,
    });

    expect(resTimeout.sucesso).toBe(false);
    expect(resTimeout.erro).toContain('timeout');

    gateway.simularTimeout = false;
    gateway.simularErroConexao = true;

    const resConexao = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 27,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_produto: 'Pizza',
      quantidade: 1,
    });

    expect(resConexao.sucesso).toBe(false);
    expect(resConexao.erro).toContain('ECONNREFUSED');
  });

  it('EARS-KDSGW-06: HttpKdsGateway respeita modo disabled via variável de ambiente', async () => {
    const originalEnv = process.env.KDS_SERVICE_URL;
    process.env.KDS_SERVICE_URL = 'disabled';

    const gateway = new HttpKdsGateway();
    const resultado = await gateway.despacharFicha({
      comanda_id: 1,
      item_comanda_id: 1,
      produto_id: 1,
      mesa: 1,
      garcom_id: 1,
      nome_produto: 'Água Mineral',
      quantidade: 1,
    });

    expect(resultado.sucesso).toBe(true);
    process.env.KDS_SERVICE_URL = originalEnv;
  });

  it('Integração via buildApp: roteia bebidas para setor "bar", lanches para "cozinha" e cancela fichas/gestão ao remover item ou cancelar comanda', async () => {
    const itensComanda: any[] = [];
    const comandaMock: any = {
      id: 15,
      mesa: 4,
      garcom_id: 1,
      status: 'aberta',
      subtotal: null,
      taxa_servico: null,
      total: null,
      forma_pagamento: null,
      aberta_em: new Date(),
      fechada_em: null,
      paga_em: null,
      cancelada_em: null,
      motivo_cancelamento: null,
      itens: itensComanda,
    };

    const produtosCatalogo = [
      {
        id: 10,
        nome: 'Chopp Pilsen 500ml',
        categoria: 'Bebidas',
        preco: new Prisma.Decimal('14.00'),
        estoque: 50,
        estoque_minimo: 10,
        ativo: true,
        criado_em: new Date(),
        atualizado_em: new Date(),
      },
      {
        id: 20,
        nome: 'X-Burger Artesanal',
        categoria: 'Lanches',
        preco: new Prisma.Decimal('28.00'),
        estoque: 30,
        estoque_minimo: 5,
        ativo: true,
        criado_em: new Date(),
        atualizado_em: new Date(),
      },
    ];

    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      usuario: {
        findUnique: vi.fn(async () => ({ id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true })),
      } as any,
      produto: {
        findUnique: vi.fn(async ({ where }: any) =>
          produtosCatalogo.find((p) => p.id === where.id) ?? null,
        ),
      } as any,
      comanda: {
        findUnique: vi.fn(async () => ({ ...comandaMock, itens: [...itensComanda] })),
        update: vi.fn(async ({ data }: any) => {
          Object.assign(comandaMock, data);
          return { ...comandaMock, itens: [...itensComanda] };
        }),
      } as any,
      itemComanda: {
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: itensComanda.length + 1,
            comanda_id: data.comanda_id,
            produto_id: data.produto_id,
            nome_copiado: data.nome_copiado,
            preco_copiado: data.preco_copiado,
            quantidade: data.quantidade,
            observacao: data.observacao ?? null,
          };
          itensComanda.push(item);
          return item;
        }),
        findFirst: vi.fn(async ({ where }: any) =>
          itensComanda.find((i) => i.id === where.id && i.comanda_id === where.comanda_id) ?? null,
        ),
        delete: vi.fn(async ({ where }: any) => {
          const idx = itensComanda.findIndex((i) => i.id === where.id);
          if (idx >= 0) itensComanda.splice(idx, 1);
        }),
      } as any,
    };

    const kdsGateway = new FakeKdsGateway();
    const eventosGestao: Array<Record<string, unknown>> = [];
    const gestaoGateway: IGestaoGateway = {
      notificarEvento: vi.fn(async (evento) => {
        eventosGestao.push(evento);
        return { sucesso: true, statusCode: 202 };
      }),
      notificarComandaPaga: vi.fn(async (evento) => {
        eventosGestao.push(evento);
        return { sucesso: true, statusCode: 202 };
      }),
    };

    const app = await buildApp({
      prisma: prisma as ClienteBanco,
      kdsGateway,
      gestaoGateway,
      logger: false,
    });

    const resBebida = await app.inject({
      method: 'POST',
      url: '/comandas/15/itens',
      payload: { produto_id: 10, quantidade: 2 },
    });
    expect(resBebida.statusCode).toBe(201);

    const resLanche = await app.inject({
      method: 'POST',
      url: '/comandas/15/itens',
      payload: { produto_id: 20, quantidade: 1 },
    });
    expect(resLanche.statusCode).toBe(201);

    expect(kdsGateway.fichasDespachadas).toHaveLength(2);
    expect(kdsGateway.fichasDespachadas[0].setor).toBe('bar');
    expect(kdsGateway.fichasDespachadas[1].setor).toBe('cozinha');

    const resRemover = await app.inject({
      method: 'DELETE',
      url: '/comandas/15/itens/1',
    });
    expect(resRemover.statusCode).toBe(204);
    expect(kdsGateway.fichasCanceladas).toContainEqual(
      expect.objectContaining({ item_comanda_id: 1 }),
    );

    const resCancelar = await app.inject({
      method: 'POST',
      url: '/comandas/15/cancelar',
      payload: { motivo: 'Cliente desistiu' },
    });
    expect(resCancelar.statusCode).toBe(200);
    expect(resCancelar.json().motivo_cancelamento).toBe('Cliente desistiu');
    expect(kdsGateway.fichasCanceladas).toContainEqual(
      expect.objectContaining({ comanda_id: 15 }),
    );
    expect(eventosGestao).toContainEqual(
      expect.objectContaining({ evento: 'comanda.cancelada', comanda_id: 15 }),
    );

    await app.close();
  });

  it('Proxy reverso /kds/* com Accept: text/html encaminha ao satélite em vez de servir index.html da SPA', async () => {
    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
    };

    const originalKdsUrl = process.env.KDS_SERVICE_URL;
    process.env.KDS_SERVICE_URL = 'http://127.0.0.1:59991';
    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    const res = await app.inject({
      method: 'GET',
      url: '/kds/fichas',
      headers: { accept: 'text/html,application/json' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().erro.codigo).toBe('SERVICO_INDISPONIVEL');

    process.env.KDS_SERVICE_URL = originalKdsUrl;
    await app.close();
  });
});
