import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { StatusComandaTipo } from '../src/modules/comandas';
import {
  HttpGestaoGateway,
  IGestaoGateway,
  GestaoGateway,
} from '../src/shared/gateways/gestao.gateway';

interface UsuarioSimulado {
  id: number;
  nome: string;
  perfil: 'garcom' | 'caixa' | 'gerente';
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

interface ItemComandaSimulado {
  id: number;
  comanda_id: number;
  produto_id: number;
  nome_copiado: string;
  preco_copiado: Prisma.Decimal;
  quantidade: number;
}

interface ProdutoSimulado {
  id: number;
  nome: string;
  categoria: string;
  preco: Prisma.Decimal;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
}

interface MovimentoEstoqueSimulado {
  id: number;
  produto_id: number;
  quantidade: number;
  tipo: string;
  motivo: string;
  comanda_id?: number | null;
  criado_em: Date;
}

interface ComandaSimulada {
  id: number;
  mesa: string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComandaTipo;
  subtotal: Prisma.Decimal | null;
  taxa_servico: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  forma_pagamento: string | null;
  aberta_em: Date;
  fechada_em: Date | null;
  paga_em: Date | null;
  itens?: ItemComandaSimulado[];
}

function criarPrismaComComandasMock(opcoes: {
  usuariosIniciais?: UsuarioSimulado[];
  comandasIniciais?: ComandaSimulada[];
  produtosIniciais?: ProdutoSimulado[];
} = {}) {
  const usuarios = (opcoes.usuariosIniciais ?? []).map((u) => ({ ...u }));
  const produtos = (opcoes.produtosIniciais ?? []).map((p) => ({ ...p }));
  const comandas = (opcoes.comandasIniciais ?? []).map((c) => ({
    ...c,
    itens: (c.itens ?? []).map((i) => ({ ...i })),
  }));
  const movimentosEstoque: MovimentoEstoqueSimulado[] = [];

  const usuarioMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const encontrado = usuarios.find((u) => u.id === where.id);
      return encontrado ? { ...encontrado } : null;
    }),
  };

  const produtoMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const encontrado = produtos.find((p) => p.id === where.id);
      return encontrado ? { ...encontrado } : null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: any }) => {
      const idx = produtos.findIndex((p) => p.id === where.id);
      if (idx >= 0) {
        if (data.estoque && typeof data.estoque.decrement === 'number') {
          produtos[idx].estoque -= data.estoque.decrement;
        }
        return { ...produtos[idx] };
      }
      return null;
    }),
  };

  const movimentoEstoqueMock = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: { data: any }) => {
      const novo: MovimentoEstoqueSimulado = {
        id: movimentosEstoque.length + 1,
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        tipo: data.tipo,
        motivo: data.motivo,
        comanda_id: data.comanda_id,
        criado_em: new Date(),
      };
      movimentosEstoque.push(novo);
      return novo;
    }),
  };

  const itemComandaMock = {
    create: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  };

  const comandaMock = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    findMany: vi.fn(async () => comandas.map((c) => ({ ...c }))),
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { id: number };
        include?: { itens?: boolean | { orderBy?: { id?: 'asc' | 'desc' } } };
      }) => {
        const encontrada = comandas.find((c) => c.id === where.id);
        if (!encontrada) return null;
        return {
          ...encontrada,
          itens: include?.itens ? (encontrada.itens ?? []).map((i) => ({ ...i })) : undefined,
        };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
        include,
      }: {
        where: { id: number };
        data: any;
        include?: { itens?: boolean };
      }) => {
        const idx = comandas.findIndex((c) => c.id === where.id);
        if (idx === -1) return null;
        comandas[idx] = {
          ...comandas[idx],
          ...data,
        };
        return {
          ...comandas[idx],
          itens: include?.itens ? (comandas[idx].itens ?? []).map((i) => ({ ...i })) : undefined,
        };
      },
    ),
  };

  const prisma: any = {
    $connect: vi.fn(async () => undefined),
    $disconnect: vi.fn(async () => undefined),
    $queryRaw: vi.fn(async () => [{ 1: 1 }]),
    $transaction: vi.fn(async (operacao: any) => operacao(prisma)),
    usuario: usuarioMock as any,
    produto: produtoMock as any,
    movimentoEstoque: movimentoEstoqueMock as any,
    comanda: comandaMock as any,
    itemComanda: itemComandaMock as any,
  };

  return { prisma, comandas, produtos, movimentosEstoque };
}

describe('HttpGestaoGateway — Ingestão de Eventos no gestao-service a partir do Core (ADR-01, ADR-07)', () => {
  const gestaoUrl = 'http://localhost:3003';
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  const payloadComandaPaga = {
    evento_id: 'a1111111-2222-3333-4444-555555555555',
    evento: 'comanda.paga',
    versao: 1,
    ocorrido_em: '2026-11-04T22:00:00.000Z',
    data_hora: '2026-11-04T22:00:00.000Z',
    timestamp: '2026-11-04T22:00:00.000Z',
    comanda_id: 10,
    mesa: 33,
    garcom_id: 1,
    forma_pagamento: 'pix',
    subtotal: '29.80',
    valor_subtotal: '29.80',
    taxa_servico: '2.98',
    total: '32.78',
    valor_total: '32.78',
    itens: [
      {
        produto_id: 30,
        nome: 'Cerveja Artesanal',
        nome_copiado: 'Cerveja Artesanal',
        preco_unitario: '14.90',
        preco_copiado: '14.90',
        quantidade: 2,
        subtotal: '29.80',
      },
    ],
  };

  describe('Classe HttpGestaoGateway / GestaoGateway (Cliente HTTP)', () => {
    it('deve enviar evento de comanda.paga com sucesso retornando 202 Accepted', async () => {
      const mockWarn = vi.fn();
      const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({
          evento_id: payloadComandaPaga.evento_id,
          evento: 'comanda.paga',
          processado: true,
          duplicado: false,
          processado_em: '2026-11-04T22:00:01.000Z',
        }),
      } as any);

      const res = await gateway.notificarComandaPaga(payloadComandaPaga);

      expect(res.sucesso).toBe(true);
      expect(res.duplicado).toBe(false);
      expect(res.statusCode).toBe(202);
      expect(mockWarn).not.toHaveBeenCalled();

      // Checa contrato HTTP
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe('http://localhost:3003/gestao/eventos');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['Accept']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual(payloadComandaPaga);
    });

    it('deve tratar idempotência com status 200 OK e duplicado: true', async () => {
      const gateway = new GestaoGateway(gestaoUrl);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          evento_id: payloadComandaPaga.evento_id,
          evento: 'comanda.paga',
          processado: true,
          duplicado: true,
          processado_em: '2026-11-04T22:00:00.000Z',
        }),
      } as any);

      const res = await gateway.notificarEvento(payloadComandaPaga);

      expect(res.sucesso).toBe(true);
      expect(res.duplicado).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('deve degradar graciosamente com log quando o gestao-service retorna 500 ou 503', async () => {
      const mockWarn = vi.fn();
      const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ erro: 'Indisponível' }),
      } as any);

      const res = await gateway.notificarComandaPaga(payloadComandaPaga);

      expect(res.sucesso).toBe(false);
      expect(res.statusCode).toBe(503);
      expect(res.erro).toContain('503');
      expect(mockWarn).toHaveBeenCalledTimes(1);
    });

    it('deve tratar timeout de 2000ms sem lançar erro', async () => {
      const mockWarn = vi.fn();
      const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';
      globalThis.fetch = vi.fn().mockRejectedValue(timeoutError);

      const res = await gateway.notificarComandaPaga(payloadComandaPaga);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toMatch(/timeout|aborted/i);
      expect(mockWarn).toHaveBeenCalledTimes(1);
    });

    it('deve tratar erro de rede (ECONNREFUSED) com degradação graciosa', async () => {
      const mockWarn = vi.fn();
      const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3003'));

      const res = await gateway.notificarEvento(payloadComandaPaga);

      expect(res.sucesso).toBe(false);
      expect(res.erro).toContain('ECONNREFUSED');
      expect(mockWarn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integração em POST /comandas/:id/pagar com GestaoGateway', () => {
    const garcomPadrao: UsuarioSimulado = {
      id: 1,
      nome: 'Carlos Garçom',
      perfil: 'garcom',
      ativo: true,
      criado_em: new Date('2026-10-20T10:00:00Z'),
      atualizado_em: new Date('2026-10-20T10:00:00Z'),
    };

    const produtoEstoque: ProdutoSimulado = {
      id: 30,
      nome: 'Cerveja Artesanal',
      categoria: 'Bebidas',
      preco: new Prisma.Decimal('14.90'),
      estoque: 10,
      estoque_minimo: 3,
      ativo: true,
    };

    const comandaFechada: ComandaSimulada = {
      id: 10,
      mesa: '33',
      nome_cliente: 'Cliente Pagador',
      garcom_id: 1,
      status: 'fechada',
      subtotal: new Prisma.Decimal('29.80'),
      taxa_servico: new Prisma.Decimal('2.98'),
      total: new Prisma.Decimal('32.78'),
      forma_pagamento: null,
      aberta_em: new Date('2026-10-20T11:00:00Z'),
      fechada_em: new Date('2026-10-20T11:45:00Z'),
      paga_em: null,
      itens: [
        {
          id: 701,
          comanda_id: 10,
          produto_id: 30,
          nome_copiado: 'Cerveja Artesanal',
          preco_copiado: new Prisma.Decimal('14.90'),
          quantidade: 2,
        },
      ],
    };

    it('Caso Online: notifica gestao-service com sucesso (202), comanda paga e estoque baixado', async () => {
      const { prisma, comandas, produtos, movimentosEstoque } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        produtosIniciais: [produtoEstoque],
        comandasIniciais: [comandaFechada],
      });

      const gestaoGatewayMock: IGestaoGateway = {
        notificarEvento: vi.fn(async () => ({
          sucesso: true,
          statusCode: 202,
          duplicado: false,
          dados: { processado: true },
        })),
        notificarComandaPaga: vi.fn(async () => ({
          sucesso: true,
          statusCode: 202,
          duplicado: false,
          dados: { processado: true },
        })),
      };

      const app = await buildApp({
        prisma,
        gestaoGateway: gestaoGatewayMock,
        logger: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'pix' },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.id).toBe(10);
      expect(corpo.status).toBe('paga');
      expect(corpo.forma_pagamento).toBe('pix');
      expect(corpo.paga_em).toBeDefined();
      expect(corpo.integracao_gestao_pendente).toBeUndefined();

      // Estoque baixado e movimento contábil registrado
      const produto = produtos.find((p) => p.id === 30);
      expect(produto?.estoque).toBe(8);
      expect(movimentosEstoque).toHaveLength(1);

      // Notificação ao gestao-service ocorreu com payload correto
      expect(gestaoGatewayMock.notificarComandaPaga).toHaveBeenCalledTimes(1);
      expect(gestaoGatewayMock.notificarComandaPaga).toHaveBeenCalledWith(
        expect.objectContaining({
          evento: 'comanda.paga',
          comanda_id: 10,
          mesa: 33,
          garcom_id: 1,
          forma_pagamento: 'pix',
          subtotal: '29.80',
          taxa_servico: '2.98',
          total: '32.78',
          itens: expect.arrayContaining([
            expect.objectContaining({
              produto_id: 30,
              nome_copiado: 'Cerveja Artesanal',
              quantidade: 2,
              preco_copiado: '14.90',
            }),
          ]),
        }),
      );

      await app.close();
    });

    it('Caso Offline / Timeout: conclui venda com 200 OK, grava comanda paga e marca integracao_gestao_pendente', async () => {
      const { prisma, produtos } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        produtosIniciais: [produtoEstoque],
        comandasIniciais: [comandaFechada],
      });

      const gestaoGatewayMock: IGestaoGateway = {
        notificarEvento: vi.fn(async () => ({
          sucesso: false,
          erro: 'The operation was aborted due to timeout',
        })),
        notificarComandaPaga: vi.fn(async () => ({
          sucesso: false,
          erro: 'The operation was aborted due to timeout',
        })),
      };

      const app = await buildApp({
        prisma,
        gestaoGateway: gestaoGatewayMock,
        logger: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'dinheiro' },
      });

      // Venda NÃO é abortada (SM-C2, ADR-07)
      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.id).toBe(10);
      expect(corpo.status).toBe('paga');
      expect(corpo.forma_pagamento).toBe('dinheiro');
      expect(corpo.integracao_gestao_pendente).toBe(true);
      expect(corpo.avisos).toContain('integracao_gestao_pendente: true');

      // Estoque é baixado normalmente
      const produto = produtos.find((p) => p.id === 30);
      expect(produto?.estoque).toBe(8);

      await app.close();
    });

    it('Degradação graciosa mesmo se o gateway lançar exceção inesperada', async () => {
      const { prisma, produtos } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        produtosIniciais: [produtoEstoque],
        comandasIniciais: [comandaFechada],
      });

      const gestaoGatewayMock: IGestaoGateway = {
        notificarEvento: vi.fn(async () => {
          throw new Error('Falha catastrófica no driver HTTP');
        }),
        notificarComandaPaga: vi.fn(async () => {
          throw new Error('Falha catastrófica no driver HTTP');
        }),
      };

      const app = await buildApp({
        prisma,
        gestaoGateway: gestaoGatewayMock,
        logger: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'cartao' },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.status).toBe('paga');
      expect(corpo.integracao_gestao_pendente).toBe(true);

      const produto = produtos.find((p) => p.id === 30);
      expect(produto?.estoque).toBe(8);

      await app.close();
    });
  });
});
