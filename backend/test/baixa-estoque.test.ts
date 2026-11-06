import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { ProdutosService } from '../src/modules/produtos/produtos.service';
import { ProdutosRepositoryPrisma } from '../src/modules/produtos/produtos.repository';

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
  tipo?: string | null;
  motivo: string;
  comanda_id?: number | null;
  criado_em: Date;
}

function criarPrismaComEstoqueMock(produtosIniciais: ProdutoSimulado[] = []) {
  const produtos = produtosIniciais.map((p) => ({ ...p }));
  const movimentosEstoque: MovimentoEstoqueSimulado[] = [];
  let proximoIdMovimento = 1;

  const produtoMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const encontrado = produtos.find((p) => p.id === where.id);
      return encontrado ? { ...encontrado } : null;
    }),
    findMany: vi.fn(async () => produtos.map((p) => ({ ...p }))),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, any>;
      }) => {
        const index = produtos.findIndex((p) => p.id === where.id);
        if (index === -1) {
          throw new Error('Produto não encontrado');
        }

        let novoEstoque = produtos[index].estoque;
        if (typeof data.estoque === 'number') {
          novoEstoque = data.estoque;
        } else if (
          data.estoque &&
          typeof data.estoque === 'object' &&
          'decrement' in data.estoque
        ) {
          const dec = Number(data.estoque.decrement);
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

  const movimentoEstoqueMock = {
    findFirst: vi.fn(
      async (params?: {
        where?: { comanda_id?: number; produto_id?: number };
      }) => {
        const encontrado = movimentosEstoque.find(
          (m) =>
            (params?.where?.comanda_id === undefined ||
              m.comanda_id === params.where.comanda_id) &&
            (params?.where?.produto_id === undefined ||
              m.produto_id === params.where.produto_id),
        );
        return encontrado ? { ...encontrado } : null;
      },
    ),
    create: vi.fn(async ({ data }: { data: any }) => {
      const novo: MovimentoEstoqueSimulado = {
        id: proximoIdMovimento++,
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        tipo: data.tipo ?? 'saida',
        motivo: data.motivo,
        comanda_id: data.comanda_id ?? null,
        criado_em: new Date(),
      };
      movimentosEstoque.push(novo);
      return { ...novo };
    }),
  };

  const prisma: ClienteBanco = {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    $transaction: vi.fn(async (operacao: any) => operacao(prisma)),
    produto: produtoMock as any,
    movimentoEstoque: movimentoEstoqueMock as any,
  };

  return { prisma, produtos, movimentosEstoque, produtoMock, movimentoEstoqueMock };
}

describe('Baixa Atômica de Estoque (Story 15.6 - RN10, RN18)', () => {
  const produtoA: ProdutoSimulado = {
    id: 1,
    nome: 'Cerveja Artesanal IPA',
    categoria: 'Bebidas',
    preco: new Prisma.Decimal('18.00'),
    estoque: 20,
    estoque_minimo: 5,
    ativo: true,
    criado_em: new Date(),
    atualizado_em: new Date(),
  };

  const produtoB: ProdutoSimulado = {
    id: 2,
    nome: 'Batata Frita Rústica',
    categoria: 'Porções',
    preco: new Prisma.Decimal('28.50'),
    estoque: 15,
    estoque_minimo: 3,
    ativo: true,
    criado_em: new Date(),
    atualizado_em: new Date(),
  };

  describe('Rota POST /produtos/baixa-estoque', () => {
    it('Efetua baixa de estoque com sucesso, reduzindo saldo e registrando movimento contábil com tipo "saida" e motivo padronizado', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComEstoqueMock([
        produtoA,
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 101,
          itens: [
            {
              produto_id: 1,
              quantidade: 4,
            },
          ],
        },
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ status: 'ok' });

      // Saldo do produto deduzido: 20 - 4 = 16
      const produtoAtualizado = produtos.find((p) => p.id === 1);
      expect(produtoAtualizado?.estoque).toBe(16);

      // Movimento contábil registrado com tipo 'saida' e motivo 'VENDA_COMANDA #X'
      expect(movimentosEstoque).toHaveLength(1);
      expect(movimentosEstoque[0]).toMatchObject({
        produto_id: 1,
        quantidade: -4,
        tipo: 'saida',
        motivo: 'VENDA_COMANDA #101',
        comanda_id: 101,
      });

      await app.close();
    });

    it('Efetua baixa de múltiplos itens em uma única comanda de forma atômica', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComEstoqueMock([
        produtoA,
        produtoB,
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 102,
          itens: [
            { produto_id: 1, quantidade: 5 },
            { produto_id: 2, quantidade: 3 },
          ],
        },
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ status: 'ok' });

      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(15); // 20 - 5
      expect(produtos.find((p) => p.id === 2)?.estoque).toBe(12); // 15 - 3
      expect(movimentosEstoque).toHaveLength(2);

      expect(movimentosEstoque[0]).toMatchObject({
        produto_id: 1,
        quantidade: -5,
        tipo: 'saida',
        motivo: 'VENDA_COMANDA #102',
        comanda_id: 102,
      });
      expect(movimentosEstoque[1]).toMatchObject({
        produto_id: 2,
        quantidade: -3,
        tipo: 'saida',
        motivo: 'VENDA_COMANDA #102',
        comanda_id: 102,
      });

      await app.close();
    });

    it('Garante idempotência estrita por (comanda_id, produto_id): 2ª chamada idêntica não deduz saldo novamente nem duplica movimento', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComEstoqueMock([
        produtoA,
      ]);
      const app = await buildApp({ prisma, logger: false });

      const payload = {
        comanda_id: 200,
        itens: [{ produto_id: 1, quantidade: 2 }],
      };

      // 1ª execução
      const res1 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload,
      });
      expect(res1.statusCode).toBe(200);
      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(18);
      expect(movimentosEstoque).toHaveLength(1);

      // 2ª execução com mesma comanda e mesmo produto (redelivery / retry HTTP)
      const res2 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload,
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json()).toEqual({ status: 'ok' });

      // O estoque permanece em 18 e não há segundo movimento
      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(18);
      expect(movimentosEstoque).toHaveLength(1);

      await app.close();
    });

    it('Permite baixa de outro produto para a mesma comanda se ainda não tiver sido baixado', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComEstoqueMock([
        produtoA,
        produtoB,
      ]);
      const app = await buildApp({ prisma, logger: false });

      // 1ª chamada: baixa apenas produtoA na comanda 300
      await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 300,
          itens: [{ produto_id: 1, quantidade: 2 }],
        },
      });
      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(18);
      expect(movimentosEstoque).toHaveLength(1);

      // 2ª chamada: payload contém produtoA (já baixado) e produtoB (novo)
      const res2 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 300,
          itens: [
            { produto_id: 1, quantidade: 2 },
            { produto_id: 2, quantidade: 4 },
          ],
        },
      });
      expect(res2.statusCode).toBe(200);

      // produtoA não foi deduzido de novo; produtoB foi deduzido
      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(18);
      expect(produtos.find((p) => p.id === 2)?.estoque).toBe(11); // 15 - 4
      expect(movimentosEstoque).toHaveLength(2);

      await app.close();
    });

    it('Retorna erro 404 NAO_ENCONTRADO caso o produto informado não exista', async () => {
      const { prisma, produtos, movimentosEstoque } = criarPrismaComEstoqueMock([
        produtoA,
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 400,
          itens: [{ produto_id: 9999, quantidade: 1 }],
        },
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
      expect(corpo.erro.mensagem).toContain('9999');

      // Nenhum estoque deduzido e nenhum movimento registrado
      expect(produtos.find((p) => p.id === 1)?.estoque).toBe(20);
      expect(movimentosEstoque).toHaveLength(0);

      await app.close();
    });

    it('Retorna 400 VALIDACAO se o payload estiver vazio ou com formato inválido', async () => {
      const { prisma } = criarPrismaComEstoqueMock([produtoA]);
      const app = await buildApp({ prisma, logger: false });

      // Sem itens
      const res1 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 500,
          itens: [],
        },
      });
      expect(res1.statusCode).toBe(400);
      expect(res1.json().erro.codigo).toBe('VALIDACAO');

      // Comanda inválida (<= 0)
      const res2 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 0,
          itens: [{ produto_id: 1, quantidade: 1 }],
        },
      });
      expect(res2.statusCode).toBe(400);
      expect(res2.json().erro.codigo).toBe('VALIDACAO');

      // Quantidade inválida (<= 0)
      const res3 = await app.inject({
        method: 'POST',
        url: '/produtos/baixa-estoque',
        payload: {
          comanda_id: 500,
          itens: [{ produto_id: 1, quantidade: 0 }],
        },
      });
      expect(res3.statusCode).toBe(400);
      expect(res3.json().erro.codigo).toBe('VALIDACAO');

      await app.close();
    });
  });

  describe('Validações no ProdutosService diretamente', () => {
    it('Lança erro de validação de domínio em chamadas com parâmetros inválidos', async () => {
      const { prisma } = criarPrismaComEstoqueMock([produtoA]);
      const repo = new ProdutosRepositoryPrisma(prisma);
      const service = new ProdutosService(repo);

      await expect(
        service.baixarEstoque({ comanda_id: -1, itens: [{ produto_id: 1, quantidade: 1 }] }),
      ).rejects.toThrow('Identificador de comanda inválido.');

      await expect(
        service.baixarEstoque({ comanda_id: 1, itens: [] }),
      ).rejects.toThrow('Itens para baixa de estoque não informados.');

      await expect(
        service.baixarEstoque({ comanda_id: 1, itens: [{ produto_id: 0, quantidade: 1 }] }),
      ).rejects.toThrow('Identificador de produto inválido');

      await expect(
        service.baixarEstoque({ comanda_id: 1, itens: [{ produto_id: 1, quantidade: 0 }] }),
      ).rejects.toThrow('Quantidade inválida');
    });
  });
});
