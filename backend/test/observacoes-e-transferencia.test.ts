import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { Prisma } from '@prisma/client';

describe('Stories 2.1.8 & 2.5.1 — Observações no Item, Transferência de Mesa e Junção de Comandas', () => {
  it('EARS-OBS-01/05: Lança item com observação personalizada e armazena na comanda', async () => {
    const itensComanda: any[] = [];
    const comandaMock = {
      id: 5,
      mesa: 3,
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

    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      produto: {
        findUnique: vi.fn(async () => ({
          id: 10,
          nome: 'X-Burger Especial',
          categoria: 'comida',
          preco: new Prisma.Decimal('32.00'),
          estoque: 20,
          estoque_minimo: 2,
          ativo: true,
        })),
      } as any,
      comanda: {
        findUnique: vi.fn(async () => comandaMock),
        findFirst: vi.fn(async () => comandaMock),
        update: vi.fn(async ({ data }: any) => ({ ...comandaMock, ...data })),
      } as any,
      itemComanda: {
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: 1,
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
      } as any,
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/comandas/5/itens',
      payload: {
        produto_id: 10,
        quantidade: 1,
        observacao: 'Ao ponto, sem maionese (Alérgico a ovo)',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.observacao).toBe('Ao ponto, sem maionese (Alérgico a ovo)');

    await app.close();
  });

  it('EARS-OBS-10: Rejeita observação que excede 240 caracteres com 400 VALIDACAO', async () => {
    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/comandas/1/itens',
      payload: {
        produto_id: 1,
        quantidade: 1,
        observacao: 'X'.repeat(241),
      },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('Story 2.5.1: Transferência de mesa e mesclagem de comandas com liberação de mesa de origem', async () => {
    const comanda1 = {
      id: 10,
      mesa: 2,
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
      itens: [{ id: 1, comanda_id: 10, produto_id: 1, nome_copiado: 'Pizza', preco_copiado: new Prisma.Decimal('40.00'), quantidade: 1, observacao: null }],
    };

    const comanda2 = {
      id: 20,
      mesa: 5,
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
      itens: [{ id: 2, comanda_id: 20, produto_id: 2, nome_copiado: 'Suco', preco_copiado: new Prisma.Decimal('10.00'), quantidade: 2, observacao: null }],
    };

    const comandas = [comanda1, comanda2];

    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      comanda: {
        findUnique: vi.fn(async ({ where }: any) => comandas.find((c) => c.id === where.id) ?? null),
        findFirst: vi.fn(async ({ where }: any) => {
          return comandas.find((c) => {
            if (where.mesa !== undefined && c.mesa !== where.mesa) return false;
            if (where.status !== undefined && c.status !== where.status) return false;
            return true;
          }) ?? null;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const com = comandas.find((c) => c.id === where.id);
          if (com) Object.assign(com, data);
          return { ...com };
        }),
      } as any,
      itemComanda: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          comandas.forEach((c) => {
            (c.itens ?? []).forEach((it) => {
              if (it.comanda_id === where.comanda_id) {
                it.comanda_id = data.comanda_id;
              }
            });
          });
          return { count: 1 };
        }),
      } as any,
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    // 1. Transferência para mesa 18 livre
    const resTransferencia = await app.inject({
      method: 'PATCH',
      url: '/comandas/10/transferir-mesa',
      payload: { nova_mesa: 18 },
    });
    expect(resTransferencia.statusCode).toBe(200);
    expect(resTransferencia.json().mesa).toBe(18);

    // 2. Transferência para mesa 5 (já ocupada pela comanda 20) -> 409 Conflito
    const resConflito = await app.inject({
      method: 'PATCH',
      url: '/comandas/10/transferir-mesa',
      payload: { nova_mesa: 5 },
    });
    expect(resConflito.statusCode).toBe(409);
    expect(resConflito.json().erro.codigo).toBe('MESA_OCUPADA');

    // 3. Mesclar comanda 20 (origem) na comanda 10 (destino)
    const resMescla = await app.inject({
      method: 'POST',
      url: '/comandas/10/mesclar',
      payload: { comanda_origem_id: 20 },
    });
    expect(resMescla.statusCode).toBe(200);

    // Comanda 20 deve ter sido cancelada com motivo de mesclagem
    expect(comanda2.status).toBe('cancelada');
    expect(comanda2.motivo_cancelamento).toContain('Mesclada com a comanda #10');

    await app.close();
  });
});
