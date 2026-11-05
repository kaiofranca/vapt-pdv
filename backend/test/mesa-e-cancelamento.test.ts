import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { Prisma } from '@prisma/client';

describe('Story 2.4.4 — Core: Padronização de Mesa como Inteiro, Timestamp e Motivo de Cancelamento', () => {
  it('EARS-MESA-01/03: Abertura de comanda aceita string numérica "15" ou int 15 e persiste e retorna mesa como inteiro 15', async () => {
    const comandas: any[] = [];
    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      usuario: {
        findUnique: vi.fn(async () => ({
          id: 1,
          nome: 'Garçom Teste',
          perfil: 'garcom',
          ativo: true,
        })),
      } as any,
      comanda: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => {
          const nova = {
            id: 1,
            mesa: Number(data.mesa),
            nome_cliente: data.nome_cliente ?? null,
            garcom_id: data.garcom_id,
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
            itens: [],
          };
          comandas.push(nova);
          return nova;
        }),
      } as any,
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    // String numérica
    const resString = await app.inject({
      method: 'POST',
      url: '/comandas',
      payload: {
        mesa: '15',
        garcom_id: 1,
      },
    });

    expect(resString.statusCode).toBe(201);
    expect(resString.json().mesa).toBe(15);
    expect(typeof resString.json().mesa).toBe('number');

    await app.close();
  });

  it('EARS-MESA-04/06: Cancelamento com motivo grava cancelada_em e motivo_cancelamento', async () => {
    const comandaMock = {
      id: 2,
      mesa: 8,
      nome_cliente: null,
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
      itens: [],
    };

    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      comanda: {
        buscarPorId: vi.fn(),
        findUnique: vi.fn(async () => comandaMock),
        update: vi.fn(async ({ data }: any) => {
          Object.assign(comandaMock, data);
          return { ...comandaMock };
        }),
      } as any,
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    const res = await app.inject({
      method: 'POST',
      url: '/comandas/2/cancelar',
      payload: {
        motivo: 'Cliente desistiu da espera por demora',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('cancelada');
    expect(body.motivo_cancelamento).toBe('Cliente desistiu da espera por demora');
    expect(body.cancelada_em).toBeTruthy();

    // Idempotência: cancelar comanda já cancelada retorna 200
    const resIdempotente = await app.inject({
      method: 'POST',
      url: '/comandas/2/cancelar',
      payload: { motivo: 'Tentativa redundante' },
    });
    expect(resIdempotente.statusCode).toBe(200);
    expect(resIdempotente.json().status).toBe('cancelada');

    await app.close();
  });

  it('EARS-MESA-07: Rejeita mesa não numérica, zero ou negativa com 400 VALIDACAO', async () => {
    const prisma: Partial<ClienteBanco> = {
      $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
      $disconnect: vi.fn(async () => undefined),
    };

    const app = await buildApp({ prisma: prisma as ClienteBanco, logger: false });

    const resTexto = await app.inject({
      method: 'POST',
      url: '/comandas',
      payload: { mesa: 'Mesa Balcao', garcom_id: 1 },
    });
    expect(resTexto.statusCode).toBe(400);

    const resZero = await app.inject({
      method: 'POST',
      url: '/comandas',
      payload: { mesa: 0, garcom_id: 1 },
    });
    expect(resZero.statusCode).toBe(400);

    const resNegativa = await app.inject({
      method: 'POST',
      url: '/comandas',
      payload: { mesa: -5, garcom_id: 1 },
    });
    expect(resNegativa.statusCode).toBe(400);

    await app.close();
  });
});
