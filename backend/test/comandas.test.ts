import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import type { ServicoUsuarios } from '../src/modules/usuarios/servico';
import {
  ehErroUnicidadePrisma,
  FormaPagamentoTipo,
  moduloComandas,
  ServicoComandasPrisma,
  StatusComandaTipo,
} from '../src/modules/comandas';

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
  observacao?: string | null;
}

interface ComandaSimulada {
  id: number;
  mesa: number | string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComandaTipo;
  subtotal: Prisma.Decimal | null;
  taxa_servico: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  forma_pagamento: FormaPagamentoTipo | null;
  aberta_em: Date;
  fechada_em: Date | null;
  paga_em: Date | null;
  cancelada_em?: Date | null;
  motivo_cancelamento?: string | null;
  itens?: ItemComandaSimulado[];
}

interface OpcoesIncludeItens {
  orderBy?: {
    id?: 'asc' | 'desc';
  };
}

interface ProdutoSimulado {
  id: number;
  nome: string;
  categoria: string;
  preco: Prisma.Decimal;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

interface MovimentoEstoqueSimulado {
  id: number;
  produto_id: number;
  quantidade: number;
  motivo: string;
  comanda_id?: number | null;
  criado_em: Date;
}

function aplicarIncludeItens(
  itensOriginais: ItemComandaSimulado[] | undefined,
  includeItens: boolean | OpcoesIncludeItens | undefined,
): ItemComandaSimulado[] | undefined {
  if (!includeItens) {
    return undefined;
  }

  const copia = (itensOriginais ?? []).map((i) => ({ ...i }));
  if (typeof includeItens === 'object' && includeItens.orderBy?.id) {
    const direcao = includeItens.orderBy.id;
    copia.sort((a, b) => (direcao === 'asc' ? a.id - b.id : b.id - a.id));
  }
  return copia;
}

function criarPrismaComComandasMock(opcoes: {
  usuariosIniciais?: UsuarioSimulado[];
  produtosIniciais?: ProdutoSimulado[];
  comandasIniciais?: ComandaSimulada[];
} = {}) {
  const usuarios = (opcoes.usuariosIniciais ?? []).map((u) => ({ ...u }));
  const produtos = (opcoes.produtosIniciais ?? []).map((p) => ({ ...p }));
  const comandas = (opcoes.comandasIniciais ?? []).map((c) => ({
    ...c,
    itens: (c.itens ?? []).map((i) => ({ ...i })),
  }));

  let proximoIdComanda =
    comandas.length > 0 ? Math.max(...comandas.map((c) => c.id)) + 1 : 1;
  let proximoIdItem = 1;
  for (const c of comandas) {
    for (const i of c.itens ?? []) {
      if (i.id >= proximoIdItem) {
        proximoIdItem = i.id + 1;
      }
    }
  }

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
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        const index = produtos.findIndex((p) => p.id === where.id);
        if (index === -1) {
          throw new Error('Record to update not found.');
        }

        let novoEstoque = produtos[index].estoque;
        if (typeof data.estoque === 'number') {
          novoEstoque = data.estoque;
        } else if (
          data.estoque &&
          typeof data.estoque === 'object' &&
          'decrement' in (data.estoque as Record<string, unknown>)
        ) {
          const dec = Number((data.estoque as { decrement: number }).decrement);
          novoEstoque = Math.max(0, novoEstoque - dec);
        }

        produtos[index] = {
          ...produtos[index],
          ...data,
          estoque: novoEstoque,
          atualizado_em: new Date(),
        };
        return { ...produtos[index] };
      },
    ),
  };

  const movimentosEstoque: MovimentoEstoqueSimulado[] = [];
  let proximoIdMovimento = 1;

  const movimentoEstoqueMock = {
    findFirst: vi.fn(async (params?: { where?: { comanda_id?: number } }) => {
      const encontrado = movimentosEstoque.find(
        (m) => m.comanda_id === params?.where?.comanda_id,
      );
      return encontrado ? { ...encontrado } : null;
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          produto_id: number;
          quantidade: number;
          motivo: string;
          comanda_id?: number;
        };
      }) => {
        const novo: MovimentoEstoqueSimulado = {
          id: proximoIdMovimento++,
          produto_id: data.produto_id,
          quantidade: data.quantidade,
          motivo: data.motivo,
          comanda_id: data.comanda_id ?? null,
          criado_em: new Date(),
        };
        movimentosEstoque.push(novo);
        return { ...novo };
      },
    ),
  };

  const itemComandaMock = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          comanda_id: number;
          produto_id: number;
          nome_copiado: string;
          preco_copiado: Prisma.Decimal;
          quantidade: number;
        };
      }) => {
        const comanda = comandas.find((c) => c.id === data.comanda_id);
        if (!comanda) {
          throw new Error('Comanda not found');
        }
        const novoItem: ItemComandaSimulado = {
          id: proximoIdItem++,
          comanda_id: data.comanda_id,
          produto_id: data.produto_id,
          nome_copiado: data.nome_copiado,
          preco_copiado: data.preco_copiado,
          quantidade: data.quantidade,
          observacao: (data as any).observacao ?? null,
        };
        if (!comanda.itens) {
          comanda.itens = [];
        }
        comanda.itens.push(novoItem);
        return { ...novoItem };
      },
    ),
    findFirst: vi.fn(
      async (params: {
        where: { id: number; comanda_id?: number };
      }) => {
        for (const c of comandas) {
          if (
            params.where.comanda_id !== undefined &&
            c.id !== params.where.comanda_id
          ) {
            continue;
          }
          const item = (c.itens ?? []).find((i) => i.id === params.where.id);
          if (item) {
            return { ...item };
          }
        }
        return null;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { quantidade?: number };
      }) => {
        for (const c of comandas) {
          const item = (c.itens ?? []).find((i) => i.id === where.id);
          if (item) {
            if (data.quantidade !== undefined) {
              item.quantidade = data.quantidade;
            }
            return { ...item };
          }
        }
        throw new Error('Item not found to update');
      },
    ),
    delete: vi.fn(
      async ({
        where,
      }: {
        where: { id: number };
      }) => {
        for (const c of comandas) {
          const idx = (c.itens ?? []).findIndex((i) => i.id === where.id);
          if (idx !== -1) {
            const [removido] = c.itens!.splice(idx, 1);
            return { ...removido };
          }
        }
        throw new Error('Item not found to delete');
      },
    ),
  };

  const comandaMock = {
    findFirst: vi.fn(
      async (params?: {
        where?: { mesa?: string; status?: StatusComandaTipo };
      }) => {
        const encontrada = comandas.find((c) => {
          if (params?.where?.mesa !== undefined && Number(c.mesa) !== Number(params.where.mesa)) {
            return false;
          }
          if (params?.where?.status !== undefined && c.status !== params.where.status) {
            return false;
          }
          return true;
        });
        return encontrada ? { ...encontrada } : null;
      },
    ),
    create: vi.fn(
      async ({
        data,
        include,
      }: {
        data: {
          mesa: string;
          nome_cliente?: string | null;
          garcom_id: number;
          status?: StatusComandaTipo;
        };
        include?: {
          itens?: boolean | OpcoesIncludeItens;
        };
      }) => {
        // Simula também o índice único parcial no banco (status = 'aberta' por mesa)
        const conflitoIndiceParcial = comandas.find(
          (c) =>
            Number(c.mesa) === Number(data.mesa) &&
            (data.status ?? 'aberta') === 'aberta' &&
            c.status === 'aberta',
        );
        if (conflitoIndiceParcial) {
          const erroUnicidade = new Error(
            'Unique constraint failed on the fields: (`mesa`)',
          ) as Error & { code: string; meta: { target: string[] } };
          erroUnicidade.code = 'P2002';
          erroUnicidade.meta = { target: ['mesa'] };
          throw erroUnicidade;
        }

        const nova: ComandaSimulada = {
          id: proximoIdComanda++,
          mesa: Number(data.mesa),
          nome_cliente: data.nome_cliente ?? null,
          garcom_id: data.garcom_id,
          status: data.status ?? 'aberta',
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
        return {
          ...nova,
          itens: aplicarIncludeItens(nova.itens, include?.itens),
        };
      },
    ),
    findMany: vi.fn(
      async (params?: {
        where?: {
          status?: StatusComandaTipo;
          mesa?: string;
          aberta_em?: {
            gte?: Date;
            lte?: Date;
          };
        };
        include?: {
          itens?: boolean | OpcoesIncludeItens;
        };
        orderBy?:
          | { aberta_em?: 'asc' | 'desc'; id?: 'asc' | 'desc' }
          | Array<{ aberta_em?: 'asc' | 'desc'; id?: 'asc' | 'desc' }>;
        take?: number;
        skip?: number;
      }) => {
        let resultado = comandas.map((c) => ({
          ...c,
          itens: aplicarIncludeItens(c.itens, params?.include?.itens),
        }));

        if (params?.where?.status !== undefined) {
          resultado = resultado.filter((c) => c.status === params.where?.status);
        }

        if (params?.where?.mesa !== undefined) {
          resultado = resultado.filter((c) => Number(c.mesa) === Number(params.where?.mesa));
        }

        if (params?.where?.aberta_em?.gte !== undefined) {
          const gte = params.where.aberta_em.gte.getTime();
          resultado = resultado.filter((c) => c.aberta_em.getTime() >= gte);
        }

        if (params?.where?.aberta_em?.lte !== undefined) {
          const lte = params.where.aberta_em.lte.getTime();
          resultado = resultado.filter((c) => c.aberta_em.getTime() <= lte);
        }

        if (params?.orderBy) {
          const criterios = Array.isArray(params.orderBy)
            ? params.orderBy
            : [params.orderBy];

          resultado.sort((a, b) => {
            for (const criterio of criterios) {
              if (criterio.aberta_em) {
                const diffData =
                  criterio.aberta_em === 'desc'
                    ? b.aberta_em.getTime() - a.aberta_em.getTime()
                    : a.aberta_em.getTime() - b.aberta_em.getTime();
                if (diffData !== 0) {
                  return diffData;
                }
              }
              if (criterio.id) {
                const diffId =
                  criterio.id === 'desc' ? b.id - a.id : a.id - b.id;
                if (diffId !== 0) {
                  return diffId;
                }
              }
            }
            return 0;
          });
        }

        if (params?.skip !== undefined) {
          resultado = resultado.slice(params.skip);
        }

        if (params?.take !== undefined) {
          resultado = resultado.slice(0, params.take);
        }

        return resultado;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { id: number };
        include?: { itens?: boolean | OpcoesIncludeItens };
      }) => {
        const encontrada = comandas.find((c) => c.id === where.id);
        if (!encontrada) {
          return null;
        }
        return {
          ...encontrada,
          itens: aplicarIncludeItens(encontrada.itens, include?.itens),
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
        data: Partial<ComandaSimulada>;
        include?: { itens?: boolean | OpcoesIncludeItens };
      }) => {
        const index = comandas.findIndex((c) => c.id === where.id);
        if (index === -1) {
          throw new Error('Comanda not found to update');
        }
        comandas[index] = {
          ...comandas[index],
          ...data,
        };
        return {
          ...comandas[index],
          itens: aplicarIncludeItens(comandas[index].itens, include?.itens),
        };
      },
    ),
  };

  const prisma: ClienteBanco = {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    $transaction: vi.fn(async <T>(fn: (tx: ClienteBanco) => Promise<T>): Promise<T> => {
      return fn(prisma);
    }),
    usuario: usuarioMock as unknown as ClienteBanco['usuario'],
    produto: produtoMock as unknown as ClienteBanco['produto'],
    movimentoEstoque: movimentoEstoqueMock as unknown as ClienteBanco['movimentoEstoque'],
    comanda: comandaMock as unknown as ClienteBanco['comanda'],
    itemComanda: itemComandaMock as unknown as ClienteBanco['itemComanda'],
  };

  return {
    prisma,
    comandaMock,
    usuarioMock,
    produtoMock,
    itemComandaMock,
    movimentoEstoqueMock,
    comandas,
    produtos,
    movimentosEstoque,
  };
}

const garcomAtivoPadrao: UsuarioSimulado = {
  id: 1,
  nome: 'Carlos Garçom',
  perfil: 'garcom',
  ativo: true,
  criado_em: new Date('2026-10-20T10:00:00Z'),
  atualizado_em: new Date('2026-10-20T10:00:00Z'),
};

const criarServicoUsuariosStub = (): ServicoUsuarios => ({
  criar: vi.fn(),
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  atualizar: vi.fn(),
  inativar: vi.fn(),
  validarGarcom: vi.fn(async (id: number) => ({
    id,
    nome: 'Garçom via Gateway',
    valido: true as const,
  })),
});

describe('Abertura e Consulta de Comandas (Story 4 - CAP-3, CAP-8)', () => {
  describe('Abertura de Comanda (POST /comandas)', () => {
    it('Abrir comanda em mesa livre com mesa string e cliente retorna 201 com status aberta, valores monetários null e itens vazios', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
          garcom_id: 1,
          nome_cliente: 'Carlos',
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo).toEqual({
        id: 1,
        mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
        nome_cliente: 'Carlos',
        garcom_id: 1,
        status: 'aberta',
        subtotal: null,
        taxa_servico: null,
        total: null,
        forma_pagamento: null,
        aberta_em: expect.any(String),
        fechada_em: null,
        paga_em: null,
        itens: [],
      });
      expect(new Date(corpo.aberta_em).toISOString()).toBe(corpo.aberta_em);

      await app.close();
    });

    it('Abrir comanda com mesa numérica e sem nome_cliente converte mesa para string e define nome_cliente como null', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 5,
          garcom_id: 1,
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.mesa).toBe(5);
      expect(corpo.nome_cliente).toBeNull();
      expect(corpo.status).toBe('aberta');
      expect(corpo.itens).toEqual([]);

      await app.close();
    });

    it('Abrir comanda normaliza espaços de mesa e nome_cliente e rejeita mesa não numérica', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const cliente100 = 'C'.repeat(100);

      const resLimitesComEspacos = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: '  12  ',
          garcom_id: 1,
          nome_cliente: `  ${cliente100}  `,
        },
      });

      expect(resLimitesComEspacos.statusCode).toBe(201);
      expect(resLimitesComEspacos.json().mesa).toBe(12);
      expect(resLimitesComEspacos.json().nome_cliente).toBe(cliente100);

      const resNomeVazio = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: '  15  ',
          garcom_id: 1,
          nome_cliente: '   ',
        },
      });

      expect(resNomeVazio.statusCode).toBe(201);
      expect(resNomeVazio.json().mesa).toBe(15);
      expect(resNomeVazio.json().nome_cliente).toBeNull();

      const resMesaInvalida = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 'Varanda 01',
          garcom_id: 1,
        },
      });
      expect(resMesaInvalida.statusCode).toBe(400);

      await app.close();
    });

    it('Abrir comanda em mesa que já teve comanda fechada, paga ou cancelada retorna 201 com sucesso', async () => {
      const dataAnterior = new Date('2026-10-20T18:00:00Z');
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: [
          {
            id: 1,
            mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
            nome_cliente: 'Cliente Antigo 1',
            garcom_id: 1,
            status: 'fechada',
            subtotal: new Prisma.Decimal('50.00'),
            taxa_servico: new Prisma.Decimal('5.00'),
            total: new Prisma.Decimal('55.00'),
            forma_pagamento: null,
            aberta_em: dataAnterior,
            fechada_em: dataAnterior,
            paga_em: null,
            itens: [],
          },
          {
            id: 2,
            mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
            nome_cliente: 'Cliente Antigo 2',
            garcom_id: 1,
            status: 'paga',
            subtotal: new Prisma.Decimal('30.00'),
            taxa_servico: new Prisma.Decimal('0.00'),
            total: new Prisma.Decimal('30.00'),
            forma_pagamento: 'pix',
            aberta_em: dataAnterior,
            fechada_em: dataAnterior,
            paga_em: dataAnterior,
            itens: [],
          },
          {
            id: 3,
            mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
            nome_cliente: 'Cliente Antigo 3',
            garcom_id: 1,
            status: 'cancelada',
            subtotal: null,
            taxa_servico: null,
            total: null,
            forma_pagamento: null,
            aberta_em: dataAnterior,
            fechada_em: null,
            paga_em: null,
            itens: [],
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
          garcom_id: 1,
          nome_cliente: 'Novo Cliente',
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.id).toBe(4);
      expect(corpo.mesa).toBe(10);
      expect(corpo.status).toBe('aberta');
      expect(corpo.nome_cliente).toBe('Novo Cliente');

      await app.close();
    });

    it('Abrir segunda comanda aberta na mesma mesa retorna 409 MESA_OCUPADA', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: [
          {
            id: 1,
            mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
            nome_cliente: 'Carlos',
            garcom_id: 1,
            status: 'aberta',
            subtotal: null,
            taxa_servico: null,
            total: null,
            forma_pagamento: null,
            aberta_em: new Date('2026-10-20T19:00:00Z'),
            fechada_em: null,
            paga_em: null,
            itens: [],
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
          garcom_id: 1,
        },
      });

      expect(resposta.statusCode).toBe(409);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('MESA_OCUPADA');
      expect(corpo.erro.detalhes).toEqual({
        mesa: 10,
        comanda_id: 1,
      });

      await app.close();
    });

    it('Abrir segunda comanda na mesma mesa em corrida (violação de índice único parcial P2002 no banco) retorna 409 MESA_OCUPADA', async () => {
      const { prisma, comandaMock } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });

      // Simula condição de corrida onde findFirst não viu registro, mas create disparou P2002 do índice único parcial
      comandaMock.findFirst.mockResolvedValueOnce(null);
      comandaMock.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed on the fields: (`mesa`)'), {
          code: 'P2002',
          meta: { target: ['comandas_mesa_aberta_unique_idx'] },
        }),
      );

      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
          garcom_id: 1,
        },
      });

      expect(resposta.statusCode).toBe(409);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('MESA_OCUPADA');
      expect(corpo.erro.detalhes).toEqual({ mesa: 10 });

      await app.close();
    });

    it('Abrir comanda com garçom inexistente retorna 422 GARCOM_INVALIDO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: '12',
          garcom_id: 99,
        },
      });

      expect(resposta.statusCode).toBe(422);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
      expect(corpo.erro.detalhes.motivo).toBe('USUARIO_NAO_ENCONTRADO');

      await app.close();
    });

    it('Abrir comanda com garçom inativo retorna 422 GARCOM_INVALIDO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [
          {
            ...garcomAtivoPadrao,
            id: 2,
            ativo: false,
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: '12',
          garcom_id: 2,
        },
      });

      expect(resposta.statusCode).toBe(422);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
      expect(corpo.erro.detalhes.motivo).toBe('USUARIO_INATIVO');

      await app.close();
    });

    it('Abrir comanda com usuário de perfil diferente de garcom (caixa ou gerente) retorna 422 GARCOM_INVALIDO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [
          {
            ...garcomAtivoPadrao,
            id: 3,
            nome: 'Maria Caixa',
            perfil: 'caixa',
            ativo: true,
          },
          {
            ...garcomAtivoPadrao,
            id: 4,
            nome: 'João Gerente',
            perfil: 'gerente',
            ativo: true,
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      for (const idNaoGarcom of [3, 4]) {
        const resposta = await app.inject({
          method: 'POST',
          url: '/comandas',
          payload: {
            mesa: '15',
            garcom_id: idNaoGarcom,
          },
        });

        expect(resposta.statusCode).toBe(422);
        const corpo = resposta.json();
        expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
        expect(corpo.erro.detalhes.motivo).toBe('PERFIL_INVALIDO');
      }

      await app.close();
    });

    it('Abrir comanda com mesa inválida (vazia, só espaços, <= 0, com espaços ao redor de zero/negativo ou decimal/float) retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      for (const mesaInvalida of [
        '',
        '   ',
        0,
        -5,
        0.5,
        1.5,
        '0',
        ' 0 ',
        ' -5 ',
        '0.5',
        '1.5',
        'M'.repeat(51),
      ]) {
        const resposta = await app.inject({
          method: 'POST',
          url: '/comandas',
          payload: {
            mesa: mesaInvalida,
            garcom_id: 1,
          },
        });

        expect(resposta.statusCode).toBe(400);
        const corpo = resposta.json();
        expect(corpo.erro.codigo).toBe('VALIDACAO');
        expect(corpo.erro.detalhes.mesa).toBeDefined();
      }

      await app.close();
    });

    it('Abrir comanda com nome_cliente acima de 100 caracteres ou garcom_id ausente retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const resClienteLongo = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
          garcom_id: 1,
          nome_cliente: 'C'.repeat(101),
        },
      });
      expect(resClienteLongo.statusCode).toBe(400);
      expect(resClienteLongo.json().erro.codigo).toBe('VALIDACAO');
      expect(resClienteLongo.json().erro.detalhes.nome_cliente).toBeDefined();

      const resSemGarcom = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: {
          mesa: 10,
        },
      });
      expect(resSemGarcom.statusCode).toBe(400);
      expect(resSemGarcom.json().erro.codigo).toBe('VALIDACAO');
      expect(resSemGarcom.json().erro.detalhes.garcom_id).toBeDefined();

      await app.close();
    });
  });

  describe('Listagem de Comandas com Filtros (GET /comandas)', () => {
    const comandasCenario: ComandaSimulada[] = [
      {
        id: 1,
        mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
        nome_cliente: 'Ana',
        garcom_id: 1,
        status: 'paga',
        subtotal: new Prisma.Decimal('25.00'),
        taxa_servico: new Prisma.Decimal('2.50'),
        total: new Prisma.Decimal('27.50'),
        forma_pagamento: 'pix',
        aberta_em: new Date('2026-10-19T18:00:00.000Z'),
        fechada_em: new Date('2026-10-19T19:00:00.000Z'),
        paga_em: new Date('2026-10-19T19:05:00.000Z'),
        itens: [
          {
            id: 1,
            comanda_id: 1,
            produto_id: 10,
            nome_copiado: 'Cerveja Pilsen',
            preco_copiado: new Prisma.Decimal('12.50'),
            quantidade: 2,
          },
        ],
      },
      {
        id: 2,
        mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
        nome_cliente: 'Bruno',
        garcom_id: 1,
        status: 'aberta',
        subtotal: null,
        taxa_servico: null,
        total: null,
        forma_pagamento: null,
        aberta_em: new Date('2026-10-20T20:00:00.000Z'),
        fechada_em: null,
        paga_em: null,
        itens: [],
      },
      {
        id: 3,
        mesa: '12',
        nome_cliente: 'Carla',
        garcom_id: 1,
        status: 'aberta',
        subtotal: null,
        taxa_servico: null,
        total: null,
        forma_pagamento: null,
        aberta_em: new Date('2026-10-21T12:00:00.000Z'),
        fechada_em: null,
        paga_em: null,
        itens: [],
      },
      {
        id: 4,
        mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
        nome_cliente: 'Daniel',
        garcom_id: 1,
        status: 'fechada',
        subtotal: new Prisma.Decimal('40.00'),
        taxa_servico: new Prisma.Decimal('0.00'),
        total: new Prisma.Decimal('40.00'),
        forma_pagamento: null,
        aberta_em: new Date('2026-10-21T15:00:00.000Z'),
        fechada_em: new Date('2026-10-21T16:00:00.000Z'),
        paga_em: null,
        itens: [],
      },
    ];

    it('Listar comandas sem filtros retorna todas ordenadas da mais recente para a mais antiga (aberta_em DESC, id DESC)', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: comandasCenario,
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas',
      });

      expect(resposta.statusCode).toBe(200);
      const lista = resposta.json();
      expect(lista.map((c: { id: number }) => c.id)).toEqual([4, 3, 2, 1]);
      expect(lista[3].itens).toEqual([
        {
          id: 1,
          produto_id: 10,
          nome_copiado: 'Cerveja Pilsen',
          preco_copiado: '12.50',
          quantidade: 2,
          observacao: null,
        },
      ]);

      await app.close();
    });

    it('Desempata ordenação por id DESC quando duas comandas possuem exatamente o mesmo aberta_em', async () => {
      const mesmoInstante = new Date('2026-10-21T20:00:00.000Z');
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: [
          {
            ...comandasCenario[1],
            id: 10,
            mesa: '1',
            aberta_em: mesmoInstante,
          },
          {
            ...comandasCenario[2],
            id: 25,
            mesa: '2',
            aberta_em: mesmoInstante,
          },
          {
            ...comandasCenario[3],
            id: 15,
            mesa: '3',
            aberta_em: mesmoInstante,
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas',
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json().map((c: { id: number }) => c.id)).toEqual([25, 15, 10]);

      await app.close();
    });

    it('Listar comandas com filtros combinados (status, mesa, de, ate, limit, offset) retorna apenas as correspondentes', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: comandasCenario,
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas?status=aberta&mesa=10&de=2026-10-20T00:00:00Z&ate=2026-10-22T00:00:00Z&limit=10&offset=0',
      });

      expect(resposta.statusCode).toBe(200);
      const lista = resposta.json();
      expect(lista).toHaveLength(1);
      expect(lista[0].id).toBe(2);
      expect(lista[0].mesa).toBe(10);
      expect(lista[0].status).toBe('aberta');
      expect(lista[0].nome_cliente).toBe('Bruno');

      await app.close();
    });

    it('Filtra isoladamente por período de/ate (incluindo ate apenas com data YYYY-MM-DD cobrindo até o fim do dia 23:59:59.999Z e nanossegundos)', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: comandasCenario,
      });
      const app = await buildApp({ prisma, logger: false });

      const resApenasDataAte = await app.inject({
        method: 'GET',
        url: '/comandas?de=2026-10-21&ate=2026-10-21',
      });

      expect(resApenasDataAte.statusCode).toBe(200);
      expect(resApenasDataAte.json().map((c: { id: number }) => c.id)).toEqual([4, 3]);

      const resComFracaoLongaEOffset = await app.inject({
        method: 'GET',
        url: '/comandas?de=2026-10-20T19:00:00.123456789Z&ate=2026-10-20T18:00:00-03:00',
      });

      expect(resComFracaoLongaEOffset.statusCode).toBe(200);
      expect(resComFracaoLongaEOffset.json().map((c: { id: number }) => c.id)).toEqual([2]);

      await app.close();
    });

    it('Aplica paginação corretamente quando limit e offset > 0 são informados', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: comandasCenario,
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas?limit=2&offset=1',
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json().map((c: { id: number }) => c.id)).toEqual([3, 2]);

      await app.close();
    });

    it('Listar comandas com período inválido (data malformada, data de calendário inexistente, offset inválido ou de > ate) retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const resMalformada = await app.inject({
        method: 'GET',
        url: '/comandas?de=data-invalida',
      });
      expect(resMalformada.statusCode).toBe(400);
      expect(resMalformada.json().erro.codigo).toBe('VALIDACAO');
      expect(resMalformada.json().erro.detalhes.de).toBeDefined();

      const resCalendarioInvalido = await app.inject({
        method: 'GET',
        url: '/comandas?ate=2026-02-30T00:00:00Z',
      });
      expect(resCalendarioInvalido.statusCode).toBe(400);
      expect(resCalendarioInvalido.json().erro.codigo).toBe('VALIDACAO');
      expect(resCalendarioInvalido.json().erro.detalhes.ate).toBeDefined();

      const resOffsetInvalido = await app.inject({
        method: 'GET',
        url: '/comandas?de=2026-10-20T10:00:00+25:00',
      });
      expect(resOffsetInvalido.statusCode).toBe(400);
      expect(resOffsetInvalido.json().erro.codigo).toBe('VALIDACAO');
      expect(resOffsetInvalido.json().erro.detalhes.de).toBeDefined();

      const resInvertido = await app.inject({
        method: 'GET',
        url: '/comandas?de=2026-10-22T00:00:00Z&ate=2026-10-20T00:00:00Z',
      });
      expect(resInvertido.statusCode).toBe(400);
      expect(resInvertido.json().erro.codigo).toBe('VALIDACAO');
      expect(resInvertido.json().erro.detalhes.de).toBeDefined();

      await app.close();
    });

    it('Listar comandas com paginação inválida (limit=0 ou limit=300) retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComComandasMock();
      const app = await buildApp({ prisma, logger: false });

      const resLimitZero = await app.inject({
        method: 'GET',
        url: '/comandas?limit=0',
      });
      expect(resLimitZero.statusCode).toBe(400);
      expect(resLimitZero.json().erro.codigo).toBe('VALIDACAO');

      const resLimitExcedido = await app.inject({
        method: 'GET',
        url: '/comandas?limit=300',
      });
      expect(resLimitExcedido.statusCode).toBe(400);
      expect(resLimitExcedido.json().erro.codigo).toBe('VALIDACAO');

      await app.close();
    });
  });

  describe('Detalhamento de Comanda (GET /comandas/:id)', () => {
    it('Consultar detalhe de comanda existente com itens fora de ordem retorna 200 com itens ordenados por id ASC e preco_copiado formatado em 2 casas', async () => {
      const dataAbertura = new Date('2026-10-21T18:30:00.000Z');
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: [
          {
            id: 1,
            mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
            nome_cliente: 'Carlos',
            garcom_id: 1,
            status: 'aberta',
            subtotal: null,
            taxa_servico: null,
            total: null,
            forma_pagamento: null,
            aberta_em: dataAbertura,
            fechada_em: null,
            paga_em: null,
            itens: [
              {
                id: 5,
                comanda_id: 1,
                produto_id: 8,
                nome_copiado: 'Cerveja Artesanal',
                preco_copiado: new Prisma.Decimal('18.00'),
                quantidade: 2,
              },
              {
                id: 2,
                comanda_id: 1,
                produto_id: 7,
                nome_copiado: 'Porção de Batata',
                preco_copiado: new Prisma.Decimal('25.50'),
                quantidade: 1,
              },
            ],
          },
        ],
      });
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas/1',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo).toEqual({
        id: 1,
        mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
        nome_cliente: 'Carlos',
        garcom_id: 1,
        status: 'aberta',
        subtotal: null,
        taxa_servico: null,
        total: null,
        forma_pagamento: null,
        aberta_em: '2026-10-21T18:30:00.000Z',
        fechada_em: null,
        paga_em: null,
        itens: [
          {
            id: 2,
            produto_id: 7,
            nome_copiado: 'Porção de Batata',
            preco_copiado: '25.50',
            quantidade: 1,
            observacao: null,
          },
          {
            id: 5,
            produto_id: 8,
            nome_copiado: 'Cerveja Artesanal',
            preco_copiado: '18.00',
            quantidade: 2,
            observacao: null,
          },
        ],
      });

      await app.close();
    });

    it('Consultar detalhe de comanda inexistente retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComComandasMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas/999',
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
      expect(corpo.erro.detalhes.id).toBeDefined();

      await app.close();
    });

    it('Consultar detalhe com id inválido retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComComandasMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/comandas/abc',
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json().erro.codigo).toBe('VALIDACAO');

      await app.close();
    });
  });

  describe('Fronteira de Contexto e Isolamento (ServicoComandasPrisma & ServicoUsuarios)', () => {
    it('ServicoComandasPrisma valida garçom exclusivamente via ServicoUsuarios injetado, sem acessar prisma.usuario', async () => {
      const { prisma, usuarioMock } = criarPrismaComComandasMock();
      // Remove prisma.usuario para provar que o módulo de comandas não depende da tabela de usuários
      delete prisma.usuario;

      const servicoUsuariosDublê = criarServicoUsuariosStub();

      const servicoComandas = new ServicoComandasPrisma(prisma, servicoUsuariosDublê);
      const comanda = await servicoComandas.abrir({
        mesa: '20',
        garcom_id: 77,
        nome_cliente: 'Cliente Isolado',
      });

      expect(servicoUsuariosDublê.validarGarcom).toHaveBeenCalledTimes(1);
      expect(servicoUsuariosDublê.validarGarcom).toHaveBeenCalledWith(77);
      expect(usuarioMock.findUnique).not.toHaveBeenCalled();
      expect(comanda.mesa).toBe(20);
      expect(comanda.garcom_id).toBe(77);
    });

    it('moduloComandas aceita servicoUsuarios customizado via opções do plugin', async () => {
      const { prisma } = criarPrismaComComandasMock();
      delete prisma.usuario;

      const validarGarcomSpy = vi.fn(async (id: number) => ({
        id,
        nome: 'Garçom Plugin',
        valido: true as const,
      }));

      const Fastify = (await import('fastify')).default;
      const app = Fastify();
      await app.register(moduloComandas, {
        prisma,
        servicoUsuarios: {
          criar: vi.fn(),
          listar: vi.fn(),
          buscarPorId: vi.fn(),
          atualizar: vi.fn(),
          inativar: vi.fn(),
          validarGarcom: validarGarcomSpy,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas',
        payload: { mesa: '1', garcom_id: 5 },
      });

      expect(res.statusCode).toBe(201);
      expect(validarGarcomSpy).toHaveBeenCalledWith(5);
      await app.close();
    });

    it('ServicoComandasPrisma valida defensivamente id, limit, offset e meta.target em chamadas diretas', async () => {
      const { prisma } = criarPrismaComComandasMock();
      const servico = new ServicoComandasPrisma(prisma, criarServicoUsuariosStub());

      await expect(servico.buscarPorId(0)).rejects.toThrow(
        'O identificador da comanda deve ser um número inteiro positivo.',
      );
      await expect(servico.listar({ limit: 0 })).rejects.toThrow(
        'O parâmetro "limit" deve ser um número inteiro entre 1 e 200.',
      );
      await expect(servico.listar({ offset: -1 })).rejects.toThrow(
        'O parâmetro "offset" deve ser um número inteiro maior ou igual a 0.',
      );

      expect(
        ehErroUnicidadePrisma({ code: 'P2002', meta: { target: ['mesa'] } }),
      ).toBe(true);
      expect(
        ehErroUnicidadePrisma({
          code: 'P2002',
          meta: { target: 'comandas_mesa_aberta_unique_idx' },
        }),
      ).toBe(true);
      expect(
        ehErroUnicidadePrisma({ code: 'P2002', meta: { target: ['outro_campo'] } }),
      ).toBe(false);
    });

    it('ServicoComandasPrisma lança erro interno amigável quando prisma.comanda não está configurado', async () => {
      const prismaSemComanda: ClienteBanco = {
        $queryRaw: vi.fn(),
      };
      const servico = new ServicoComandasPrisma(
        prismaSemComanda,
        criarServicoUsuariosStub(),
      );

      await expect(servico.buscarPorId(1)).rejects.toThrow(
        'Repositório de comandas não configurado no cliente do banco.',
      );
    });
  });

  describe('Lançamento, Ajuste e Remoção de Itens (Story 5 - CAP-4)', () => {
    const produtoAtivoPadrao: ProdutoSimulado = {
      id: 10,
      nome: 'Chopp Pilsen 500ml',
      categoria: 'Bebidas',
      preco: new Prisma.Decimal('14.90'),
      estoque: 20,
      estoque_minimo: 5,
      ativo: true,
      criado_em: new Date('2026-10-20T10:00:00Z'),
      atualizado_em: new Date('2026-10-20T10:00:00Z'),
    };

    const produtoInativoPadrao: ProdutoSimulado = {
      id: 11,
      nome: 'Cerveja Artesanal Esgotada',
      categoria: 'Bebidas',
      preco: new Prisma.Decimal('22.00'),
      estoque: 0,
      estoque_minimo: 2,
      ativo: false,
      criado_em: new Date('2026-10-20T10:00:00Z'),
      atualizado_em: new Date('2026-10-20T10:00:00Z'),
    };

    const comandaAbertaPadrao: ComandaSimulada = {
      id: 1,
      mesa: 10,
        cancelada_em: null,
        motivo_cancelamento: null,
      nome_cliente: 'Cliente Teste',
      garcom_id: 1,
      status: 'aberta',
      subtotal: null,
      taxa_servico: null,
      total: null,
      forma_pagamento: null,
      aberta_em: new Date('2026-10-20T10:00:00Z'),
      fechada_em: null,
      paga_em: null,
      itens: [],
    };

    describe('Lançamento de Itens (POST /comandas/:id/itens)', () => {
      it('Lança item com sucesso em comanda aberta, congelando nome e preço unitário', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: {
            produto_id: 10,
            quantidade: 2,
          },
        });

        expect(res.statusCode).toBe(201);
        const item = res.json();
        expect(item.id).toBeDefined();
        expect(item.produto_id).toBe(10);
        expect(item.nome_copiado).toBe('Chopp Pilsen 500ml');
        expect(item.preco_copiado).toBe('14.90');
        expect(item.quantidade).toBe(2);

        // Verifica que o item aparece no detalhe da comanda
        const resDetalhe = await app.inject({
          method: 'GET',
          url: '/comandas/1',
        });
        expect(resDetalhe.statusCode).toBe(200);
        const comanda = resDetalhe.json();
        expect(comanda.itens).toHaveLength(1);
        expect(comanda.itens[0].nome_copiado).toBe('Chopp Pilsen 500ml');
        expect(comanda.itens[0].preco_copiado).toBe('14.90');
        await app.close();
      });

      it('Garante o Snapshot Pattern: reajuste de preço de produto no cardápio NÃO altera itens já lançados', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        // Lança com preco original 14.90
        await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 10, quantidade: 3 },
        });

        // Altera o preço do produto no catálogo para 25.00
        const resPreco = await app.inject({
          method: 'PATCH',
          url: '/produtos/10',
          payload: { preco: '25.00' },
        });
        expect(resPreco.statusCode).toBe(200);

        // Consulta a comanda e comprova que o preço continua congelado em 14.90
        const resComanda = await app.inject({
          method: 'GET',
          url: '/comandas/1',
        });
        expect(resComanda.statusCode).toBe(200);
        const comanda = resComanda.json();
        expect(comanda.itens[0].preco_copiado).toBe('14.90');
        await app.close();
      });

      it('Rejeita lançamento com quantidade menor ou igual a zero com 400 VALIDACAO', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const resZero = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 10, quantidade: 0 },
        });
        expect(resZero.statusCode).toBe(400);
        expect(resZero.json().erro.codigo).toBe('VALIDACAO');

        const resNegativo = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 10, quantidade: -2 },
        });
        expect(resNegativo.statusCode).toBe(400);
        expect(resNegativo.json().erro.codigo).toBe('VALIDACAO');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao tentar lançar item em comanda inexistente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/999/itens',
          payload: { produto_id: 10, quantidade: 1 },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });

      it('Retorna 409 COMANDA_NAO_ABERTA ao tentar lançar item em comanda fechada, paga ou cancelada', async () => {
        const comandaFechada: ComandaSimulada = {
          ...comandaAbertaPadrao,
          id: 2,
          mesa: '15',
          status: 'fechada',
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaFechada],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/2/itens',
          payload: { produto_id: 10, quantidade: 1 },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao lançar produto inexistente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 999, quantidade: 1 },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });

      it('Retorna 422 PRODUTO_INATIVO ao lançar produto inativo', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoInativoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 11, quantidade: 1 },
        });

        expect(res.statusCode).toBe(422);
        expect(res.json().erro.codigo).toBe('PRODUTO_INATIVO');
        await app.close();
      });

      it('Retorna 409 ESTOQUE_INSUFICIENTE ao lançar quantidade maior que o estoque disponível', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao], // estoque = 20
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/itens',
          payload: { produto_id: 10, quantidade: 25 },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('ESTOQUE_INSUFICIENTE');
        await app.close();
      });
    });

    describe('Ajuste de Quantidade de Item (PATCH /comandas/:id/itens/:itemId)', () => {
      const itemExistente: ItemComandaSimulado = {
        id: 101,
        comanda_id: 1,
        produto_id: 10,
        nome_copiado: 'Chopp Pilsen 500ml',
        preco_copiado: new Prisma.Decimal('14.90'),
        quantidade: 2,
      };

      it('Ajusta quantidade para mais com estoque suficiente retornando 200', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao], // estoque = 20
          comandasIniciais: [{ ...comandaAbertaPadrao, itens: [itemExistente] }],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'PATCH',
          url: '/comandas/1/itens/101',
          payload: { quantidade: 5 }, // delta = 3, estoque = 20
        });

        expect(res.statusCode).toBe(200);
        const item = res.json();
        expect(item.id).toBe(101);
        expect(item.quantidade).toBe(5);
        await app.close();
      });

      it('Retorna 409 ESTOQUE_INSUFICIENTE ao ajustar quantidade para mais excedendo estoque', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao], // estoque = 20
          comandasIniciais: [{ ...comandaAbertaPadrao, itens: [itemExistente] }],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'PATCH',
          url: '/comandas/1/itens/101',
          payload: { quantidade: 25 }, // delta = 23 > estoque 20
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('ESTOQUE_INSUFICIENTE');
        await app.close();
      });

      it('Ajusta quantidade para menos sem exigir checagem de novo estoque', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [{ ...comandaAbertaPadrao, itens: [itemExistente] }],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'PATCH',
          url: '/comandas/1/itens/101',
          payload: { quantidade: 1 },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().quantidade).toBe(1);
        await app.close();
      });

      it('Retorna 409 COMANDA_NAO_ABERTA ao tentar ajustar item em comanda não aberta', async () => {
        const comandaFechadaComItem: ComandaSimulada = {
          ...comandaAbertaPadrao,
          id: 5,
          status: 'fechada',
          itens: [{ ...itemExistente, comanda_id: 5 }],
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaFechadaComItem],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'PATCH',
          url: '/comandas/5/itens/101',
          payload: { quantidade: 3 },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao tentar ajustar item inexistente ou pertencente a outra comanda', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'PATCH',
          url: '/comandas/1/itens/999',
          payload: { quantidade: 2 },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });
    });

    describe('Remoção de Itens (DELETE /comandas/:id/itens/:itemId)', () => {
      const itemExistente: ItemComandaSimulado = {
        id: 201,
        comanda_id: 1,
        produto_id: 10,
        nome_copiado: 'Chopp Pilsen 500ml',
        preco_copiado: new Prisma.Decimal('14.90'),
        quantidade: 2,
      };

      it('Remove item de comanda aberta retornando 204 e expurga o item do detalhe', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [{ ...comandaAbertaPadrao, itens: [itemExistente] }],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'DELETE',
          url: '/comandas/1/itens/201',
        });

        expect(res.statusCode).toBe(204);

        const resDetalhe = await app.inject({
          method: 'GET',
          url: '/comandas/1',
        });
        expect(resDetalhe.json().itens).toHaveLength(0);
        await app.close();
      });

      it('Retorna 409 COMANDA_NAO_ABERTA ao tentar remover item de comanda que não esteja aberta', async () => {
        const comandaPaga: ComandaSimulada = {
          ...comandaAbertaPadrao,
          id: 3,
          status: 'paga',
          itens: [{ ...itemExistente, comanda_id: 3 }],
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaPaga],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'DELETE',
          url: '/comandas/3/itens/201',
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao tentar remover item inexistente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          produtosIniciais: [produtoAtivoPadrao],
          comandasIniciais: [comandaAbertaPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'DELETE',
          url: '/comandas/1/itens/999',
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });
    });

    describe('Validações Defensivas e Chamadas Diretas do Serviço', () => {
      it('Lança erro defensivo ao chamar lancarItem, ajustarItem ou removerItem com IDs inválidos', async () => {
        const { prisma } = criarPrismaComComandasMock();
        const servico = new ServicoComandasPrisma(
          prisma,
          criarServicoUsuariosStub(),
        );

        await expect(
          servico.lancarItem(0, { produto_id: 1, quantidade: 1 }),
        ).rejects.toThrow('Identificador de comanda inválido.');
        await expect(
          servico.lancarItem(1, { produto_id: 0, quantidade: 1 }),
        ).rejects.toThrow('Identificador de produto inválido.');
        await expect(
          servico.lancarItem(1, { produto_id: 1, quantidade: 0 }),
        ).rejects.toThrow('Quantidade inválida para lançamento.');

        await expect(
          servico.ajustarItem(0, 1, { quantidade: 1 }),
        ).rejects.toThrow('Identificador de comanda inválido.');
        await expect(
          servico.ajustarItem(1, 0, { quantidade: 1 }),
        ).rejects.toThrow('Identificador de item inválido.');
        await expect(
          servico.ajustarItem(1, 1, { quantidade: 0 }),
        ).rejects.toThrow('Quantidade inválida para ajuste.');

        await expect(servico.removerItem(0, 1)).rejects.toThrow(
          'Identificador de comanda inválido.',
        );
        await expect(servico.removerItem(1, 0)).rejects.toThrow(
          'Identificador de item inválido.',
        );
      });

      it('Lança erro amigável quando servicoProdutos não está configurado', async () => {
        const { prisma } = criarPrismaComComandasMock({
          comandasIniciais: [comandaAbertaPadrao],
        });
        // Sem injetar servicoProdutos
        const servico = new ServicoComandasPrisma(
          prisma,
          criarServicoUsuariosStub(),
        );

        await expect(
          servico.lancarItem(1, { produto_id: 1, quantidade: 1 }),
        ).rejects.toThrow(
          'Serviço de produtos não configurado no serviço de comandas.',
        );
      });
    });
  });

  describe('Fechamento e Cancelamento de Comandas (Story 6 - CAP-5, CAP-7)', () => {
    const itemComandaExemplo: ItemComandaSimulado = {
      id: 501,
      comanda_id: 1,
      produto_id: 10,
      nome_copiado: 'Chopp Pilsen 500ml',
      preco_copiado: new Prisma.Decimal('14.90'),
      quantidade: 2, // 2 x 14.90 = 29.80
    };

    const comandaComItens: ComandaSimulada = {
      id: 1,
      mesa: '12',
      nome_cliente: 'Cliente Mesa 12',
      garcom_id: 1,
      status: 'aberta',
      subtotal: null,
      taxa_servico: null,
      total: null,
      forma_pagamento: null,
      aberta_em: new Date('2026-10-21T18:00:00Z'),
      fechada_em: null,
      paga_em: null,
      itens: [itemComandaExemplo],
    };

    describe('Fechamento de Comanda (POST /comandas/:id/fechar)', () => {
      it('Fecha comanda aberta com taxa de serviço de 10% retornando 200 e valores gravados separadamente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaComItens],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/fechar',
          payload: { aplicar_taxa_servico: true },
        });

        expect(res.statusCode).toBe(200);
        const corpo = res.json();
        expect(corpo.id).toBe(1);
        expect(corpo.status).toBe('fechada');
        expect(corpo.subtotal).toBe('29.80');
        expect(corpo.taxa_servico).toBe('2.98');
        expect(corpo.total).toBe('32.78');
        expect(corpo.fechada_em).toBeDefined();
        await app.close();
      });

      it('Fecha comanda aberta sem taxa de serviço com taxa_servico igual a "0.00"', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaComItens],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/fechar',
          payload: { aplicar_taxa_servico: false },
        });

        expect(res.statusCode).toBe(200);
        const corpo = res.json();
        expect(corpo.status).toBe('fechada');
        expect(corpo.subtotal).toBe('29.80');
        expect(corpo.taxa_servico).toBe('0.00');
        expect(corpo.total).toBe('29.80');
        await app.close();
      });

      it('Aplica arredondamento HALF_UP exato em dízimas monetárias (ex.: subtotal 33.35 com 10% resulta em taxa 3.34)', async () => {
        const itemDizima: ItemComandaSimulado = {
          id: 502,
          comanda_id: 2,
          produto_id: 20,
          nome_copiado: 'Prato Especial',
          preco_copiado: new Prisma.Decimal('33.35'),
          quantidade: 1,
        };
        const comandaDizima: ComandaSimulada = {
          ...comandaComItens,
          id: 2,
          mesa: '14',
          itens: [itemDizima],
        };

        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaDizima],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/2/fechar',
          payload: { aplicar_taxa_servico: true },
        });

        expect(res.statusCode).toBe(200);
        const corpo = res.json();
        expect(corpo.subtotal).toBe('33.35');
        expect(corpo.taxa_servico).toBe('3.34');
        expect(corpo.total).toBe('36.69');
        await app.close();
      });

      it('Retorna 409 COMANDA_SEM_ITENS ao tentar fechar comanda vazia', async () => {
        const comandaVazia: ComandaSimulada = {
          ...comandaComItens,
          id: 3,
          itens: [],
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaVazia],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/3/fechar',
          payload: { aplicar_taxa_servico: true },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_SEM_ITENS');
        await app.close();
      });

      it('Retorna 409 COMANDA_NAO_ABERTA ao tentar fechar comanda já fechada, paga ou cancelada', async () => {
        const comandaJaFechada: ComandaSimulada = {
          ...comandaComItens,
          id: 4,
          status: 'fechada',
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaJaFechada],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/4/fechar',
          payload: { aplicar_taxa_servico: true },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao tentar fechar comanda inexistente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/999/fechar',
          payload: { aplicar_taxa_servico: true },
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });

      it('Retorna 400 VALIDACAO ao tentar fechar comanda com body inválido', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaComItens],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/fechar',
          payload: { aplicar_taxa_servico: 'invalido' },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json().erro.codigo).toBe('VALIDACAO');
        await app.close();
      });
    });

    describe('Cancelamento de Comanda (POST /comandas/:id/cancelar)', () => {
      it('Cancela comanda aberta com sucesso e libera a mesa', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaComItens],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/1/cancelar',
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().status).toBe('cancelada');

        // Como foi cancelada, agora é possível abrir uma nova comanda na mesma mesa
        const resNova = await app.inject({
          method: 'POST',
          url: '/comandas',
          payload: { mesa: '12', garcom_id: 1 },
        });
        expect(resNova.statusCode).toBe(201);
        await app.close();
      });

      it('Retorna 409 COMANDA_NAO_ABERTA ao tentar cancelar comanda já fechada ou paga', async () => {
        const comandaFechada: ComandaSimulada = {
          ...comandaComItens,
          id: 6,
          status: 'fechada',
        };
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
          comandasIniciais: [comandaFechada],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/6/cancelar',
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');
        await app.close();
      });

      it('Retorna 404 NAO_ENCONTRADO ao tentar cancelar comanda inexistente', async () => {
        const { prisma } = criarPrismaComComandasMock({
          usuariosIniciais: [garcomAtivoPadrao],
        });
        const app = await buildApp({ prisma, logger: false });

        const res = await app.inject({
          method: 'POST',
          url: '/comandas/999/cancelar',
        });

        expect(res.statusCode).toBe(404);
        expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
        await app.close();
      });
    });

    describe('Validações Defensivas de Fechamento e Cancelamento', () => {
      it('ServicoComandasPrisma valida defensivamente IDs e payload em chamadas diretas', async () => {
        const { prisma } = criarPrismaComComandasMock();
        const servico = new ServicoComandasPrisma(
          prisma,
          criarServicoUsuariosStub(),
        );

        await expect(
          servico.fechar(0, { aplicar_taxa_servico: true }),
        ).rejects.toThrow('Identificador de comanda inválido.');
        await expect(
          servico.fechar(1, null as unknown as { aplicar_taxa_servico: boolean }),
        ).rejects.toThrow('Dados de fechamento inválidos.');
        await expect(servico.cancelar(0)).rejects.toThrow(
          'Identificador de comanda inválido.',
        );
      });
    });
  });

  describe('Pagamento com Baixa de Estoque Transacional (Story 7 - CAP-6)', () => {
    const produtoEstoque: ProdutoSimulado = {
      id: 30,
      nome: 'Vinho Tinto Especial',
      categoria: 'Bebidas',
      preco: new Prisma.Decimal('60.00'),
      estoque: 10,
      estoque_minimo: 2,
      ativo: true,
      criado_em: new Date('2026-10-21T10:00:00Z'),
      atualizado_em: new Date('2026-10-21T10:00:00Z'),
    };

    const itemVinho: ItemComandaSimulado = {
      id: 801,
      comanda_id: 10,
      produto_id: 30,
      nome_copiado: 'Vinho Tinto Especial',
      preco_copiado: new Prisma.Decimal('60.00'),
      quantidade: 2,
    };

    const comandaFechadaParaPagar: ComandaSimulada = {
      id: 10,
      mesa: '33',
      nome_cliente: 'Cliente Pagador',
      garcom_id: 1,
      status: 'fechada',
      subtotal: new Prisma.Decimal('120.00'),
      taxa_servico: new Prisma.Decimal('12.00'),
      total: new Prisma.Decimal('132.00'),
      forma_pagamento: null,
      aberta_em: new Date('2026-10-21T19:00:00Z'),
      fechada_em: new Date('2026-10-21T20:00:00Z'),
      paga_em: null,
      itens: [itemVinho],
    };

    it('Paga comanda fechada com Pix com sucesso, preenchendo paga_em e baixando estoque transacionalmente', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        produtosIniciais: [produtoEstoque], // estoque = 10
        comandasIniciais: [comandaFechadaParaPagar], // 2 garrafas
      });
      const app = await buildApp({ prisma, logger: false });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: {
          forma_pagamento: 'pix',
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.id).toBe(10);
      expect(corpo.status).toBe('paga');
      expect(corpo.forma_pagamento).toBe('pix');
      expect(corpo.paga_em).toBeDefined();

      // Comprova que o estoque do produto foi deduzido (10 - 2 = 8)
      const produtoNoBanco = produtos.find((p) => p.id === 30);
      expect(produtoNoBanco?.estoque).toBe(8);

      // Comprova que foi gerado o registro em movimentos_estoque
      expect(movimentosEstoque).toHaveLength(1);
      expect(movimentosEstoque[0].produto_id).toBe(30);
      expect(movimentosEstoque[0].quantidade).toBe(-2);
      expect(movimentosEstoque[0].comanda_id).toBe(10);
      expect(movimentosEstoque[0].motivo).toBe('VENDA_COMANDA #10');

      await app.close();
    });

    it('Garante a Imutabilidade Total da comanda paga (RN03): rejeita novas mutações e repagamento', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        produtosIniciais: [produtoEstoque],
        comandasIniciais: [comandaFechadaParaPagar],
      });
      const app = await buildApp({ prisma, logger: false });

      // Paga a comanda
      await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'cartao' },
      });

      // 1. Tentar pagar novamente deve falhar com 409
      const repagamento = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'dinheiro' },
      });
      expect(repagamento.statusCode).toBe(409);
      expect(repagamento.json().erro.codigo).toBe('COMANDA_NAO_FECHADA');

      // 2. Tentar lançar item em comanda paga deve falhar com 409
      const lancarItem = await app.inject({
        method: 'POST',
        url: '/comandas/10/itens',
        payload: { produto_id: 30, quantidade: 1 },
      });
      expect(lancarItem.statusCode).toBe(409);
      expect(lancarItem.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');

      // 3. Tentar ajustar item em comanda paga deve falhar com 409
      const ajustarItem = await app.inject({
        method: 'PATCH',
        url: '/comandas/10/itens/801',
        payload: { quantidade: 5 },
      });
      expect(ajustarItem.statusCode).toBe(409);
      expect(ajustarItem.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');

      // 4. Tentar remover item em comanda paga deve falhar com 409
      const removerItem = await app.inject({
        method: 'DELETE',
        url: '/comandas/10/itens/801',
      });
      expect(removerItem.statusCode).toBe(409);
      expect(removerItem.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');

      // 5. Tentar fechar comanda já paga deve falhar com 409
      const fechar = await app.inject({
        method: 'POST',
        url: '/comandas/10/fechar',
        payload: { aplicar_taxa_servico: true },
      });
      expect(fechar.statusCode).toBe(409);
      expect(fechar.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');

      // 6. Tentar cancelar comanda já paga deve falhar com 409
      const cancelar = await app.inject({
        method: 'POST',
        url: '/comandas/10/cancelar',
      });
      expect(cancelar.statusCode).toBe(409);
      expect(cancelar.json().erro.codigo).toBe('COMANDA_NAO_ABERTA');

      await app.close();
    });

    it('Retorna 409 COMANDA_NAO_FECHADA ao tentar pagar comanda aberta sem fechar previamente', async () => {
      const comandaAbertaParaPagar: ComandaSimulada = {
        ...comandaFechadaParaPagar,
        id: 11,
        status: 'aberta',
      };
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        produtosIniciais: [produtoEstoque],
        comandasIniciais: [comandaAbertaParaPagar],
      });
      const app = await buildApp({ prisma, logger: false });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/11/pagar',
        payload: { forma_pagamento: 'dinheiro' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().erro.codigo).toBe('COMANDA_NAO_FECHADA');
      await app.close();
    });

    it('Retorna 404 NAO_ENCONTRADO ao tentar pagar comanda inexistente', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
      });
      const app = await buildApp({ prisma, logger: false });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/999/pagar',
        payload: { forma_pagamento: 'pix' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
      await app.close();
    });

    it('Retorna 400 VALIDACAO ao pagar com forma_pagamento inválida', async () => {
      const { prisma } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomAtivoPadrao],
        comandasIniciais: [comandaFechadaParaPagar],
      });
      const app = await buildApp({ prisma, logger: false });

      const res = await app.inject({
        method: 'POST',
        url: '/comandas/10/pagar',
        payload: { forma_pagamento: 'fiado' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().erro.codigo).toBe('VALIDACAO');
      await app.close();
    });

    it('Garante a idempotência da rota interna POST /produtos/baixa-estoque por comanda_id (RN10 / RN18)', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComComandasMock({
        produtosIniciais: [produtoEstoque], // estoque = 10
      });
      const app = await buildApp({ prisma, logger: false });

      // 1ª chamada de baixa
      const res1 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 10,
          itens: [{ produto_id: 30, quantidade: 3 }],
        },
      });
      expect(res1.statusCode).toBe(200);
      expect(produtos.find((p) => p.id === 30)?.estoque).toBe(7);
      expect(movimentosEstoque).toHaveLength(1);

      // 2ª chamada com o MESMO comanda_id
      const res2 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 10,
          itens: [{ produto_id: 30, quantidade: 3 }],
        },
      });
      expect(res2.statusCode).toBe(200);
      // Estoque NÃO é deduzido novamente e NÃO gera novo movimento
      expect(produtos.find((p) => p.id === 30)?.estoque).toBe(7);
      expect(movimentosEstoque).toHaveLength(1);

      await app.close();
    });

    it('Validações defensivas de pagamento em chamadas diretas ao serviço', async () => {
      const { prisma } = criarPrismaComComandasMock();
      const servico = new ServicoComandasPrisma(
        prisma,
        criarServicoUsuariosStub(),
      );

      await expect(
        servico.pagar(0, { forma_pagamento: 'pix' }),
      ).rejects.toThrow('Identificador de comanda inválido.');
      await expect(
        servico.pagar(1, { forma_pagamento: 'invalido' as FormaPagamentoTipo }),
      ).rejects.toThrow('Forma de pagamento inválida.');
    });
  });
});
