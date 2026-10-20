import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { ServicoProdutosPrisma } from '../src/modules/produtos/servico';

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

function criarPrismaComProdutosMock(produtosIniciais: ProdutoSimulado[] = []) {
  const produtos = produtosIniciais.map((p) => ({ ...p }));
  let proximoId = produtos.length > 0 ? Math.max(...produtos.map((p) => p.id)) + 1 : 1;

  const produtoMock = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          nome: string;
          categoria: string;
          preco: Prisma.Decimal;
          estoque: number;
          estoque_minimo?: number;
          ativo?: boolean;
        };
      }) => {
        const novo: ProdutoSimulado = {
          id: proximoId++,
          nome: data.nome,
          categoria: data.categoria,
          preco: data.preco,
          estoque: data.estoque,
          estoque_minimo: data.estoque_minimo ?? 0,
          ativo: data.ativo ?? true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        };
        produtos.push(novo);
        return novo;
      },
    ),
    findMany: vi.fn(
      async (params?: {
        where?: { categoria?: string; ativo?: boolean };
        take?: number;
        skip?: number;
      }) => {
        let resultado = [...produtos];
        if (params?.where?.categoria !== undefined) {
          resultado = resultado.filter((p) => p.categoria === params.where?.categoria);
        }
        if (params?.where?.ativo !== undefined) {
          resultado = resultado.filter((p) => p.ativo === params.where?.ativo);
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
        data: Partial<ProdutoSimulado>;
      }) => {
        const index = produtos.findIndex((p) => p.id === where.id);
        if (index === -1) {
          throw new Error('Record to update not found.');
        }
        produtos[index] = {
          ...produtos[index],
          ...data,
          atualizado_em: new Date(),
        };
        return { ...produtos[index] };
      },
    ),
  };

  const prisma: ClienteBanco = {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    produto: produtoMock as unknown as ClienteBanco['produto'],
  };

  return { prisma, produtoMock, produtos };
}

describe('CRUD de Produtos com Estoque (Story 3 - CAP-1, CAP-6)', () => {
  describe('Criação de Produto (POST /produtos)', () => {
    it('Criar produto válido com estoque_minimo explícito retorna 201 com preco formatado e ativo=true', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: '12.50',
          estoque: 20,
          estoque_minimo: 5,
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.nome).toBe('Cerveja');
      expect(corpo.categoria).toBe('Bebidas');
      expect(corpo.preco).toBe('12.50');
      expect(corpo.estoque).toBe(20);
      expect(corpo.estoque_minimo).toBe(5);
      expect(corpo.ativo).toBe(true);
      expect(corpo.criado_em).toBeDefined();
      expect(corpo.atualizado_em).toBeDefined();
    });

    it('Criar produto válido sem estoque_minimo e preço numérico inteiro adota estoque_minimo=0 e formata preço com 2 casas', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Porção Batata',
          categoria: 'Petiscos',
          preco: 25,
          estoque: 10,
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.nome).toBe('Porção Batata');
      expect(corpo.preco).toBe('25.00');
      expect(corpo.estoque_minimo).toBe(0);
      expect(corpo.ativo).toBe(true);
    });

    it('Criar produto com preço numérico de uma casa decimal serializa na saída com 2 casas', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Refrigerante',
          categoria: 'Bebidas',
          preco: 8.5,
          estoque: 15,
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.preco).toBe('8.50');
      expect(corpo.estoque_minimo).toBe(0);
    });

    it('Criar produto com campos obrigatórios ausentes retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Item',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes).toBeDefined();
    });

    it('Criar produto com preço negativo retorna 400 VALIDACAO detalhando campo preco', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Item',
          categoria: 'Geral',
          preco: '-5.00',
          estoque: 1,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.preco).toBeDefined();
    });

    it('Criar produto com mais de 2 casas decimais no preço retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Item',
          categoria: 'Geral',
          preco: '10.999',
          estoque: 1,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.preco).toBeDefined();
    });

    it('Criar produto com estoque negativo retorna 400 VALIDACAO detalhando estoque', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Item',
          categoria: 'Geral',
          preco: '10.00',
          estoque: -1,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.estoque).toBeDefined();
    });

    it('Criar produto com estoque_minimo negativo retorna 400 VALIDACAO detalhando estoque_minimo', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'Item',
          categoria: 'Geral',
          preco: '10.00',
          estoque: 10,
          estoque_minimo: -1,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.estoque_minimo).toBeDefined();
    });

    it('Criar produto com nome ou categoria vazios ou só espaços retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: '   ',
          categoria: '',
          preco: '10.00',
          estoque: 5,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
    });

    it('Criar produto com nome > 100 caracteres ou categoria > 50 retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos',
        payload: {
          nome: 'a'.repeat(101),
          categoria: 'b'.repeat(51),
          preco: '10.00',
          estoque: 1,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
    });
  });

  describe('Listagem de Produtos (GET /produtos)', () => {
    it('Listar produtos com filtros e paginação retorna 200 com preços formatados', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja Pilsen',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 2,
          nome: 'Cerveja IPA',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('18.00'),
          estoque: 10,
          estoque_minimo: 2,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 3,
          nome: 'Batata Frita',
          categoria: 'Petiscos',
          preco: new Prisma.Decimal('25.00'),
          estoque: 15,
          estoque_minimo: 3,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 4,
          nome: 'Vinho Tinto',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('50.00'),
          estoque: 5,
          estoque_minimo: 1,
          ativo: false,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos?categoria=Bebidas&ativo=true&limit=10&offset=0',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(Array.isArray(corpo)).toBe(true);
      expect(corpo.length).toBe(2);
      expect(corpo[0].nome).toBe('Cerveja Pilsen');
      expect(corpo[0].preco).toBe('12.50');
      expect(corpo[1].nome).toBe('Cerveja IPA');
      expect(corpo[1].preco).toBe('18.00');
    });

    it('Listar produtos filtrando apenas por ativo=false retorna apenas produtos inativos', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja Pilsen',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 2,
          nome: 'Vinho Tinto',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('50.00'),
          estoque: 5,
          estoque_minimo: 1,
          ativo: false,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos?ativo=false',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.length).toBe(1);
      expect(corpo[0].id).toBe(2);
      expect(corpo[0].ativo).toBe(false);
    });

    it('Listar produtos filtrando apenas por categoria retorna apenas produtos correspondentes', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja Pilsen',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 2,
          nome: 'Batata Frita',
          categoria: 'Petiscos',
          preco: new Prisma.Decimal('25.00'),
          estoque: 15,
          estoque_minimo: 3,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos?categoria=Petiscos',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.length).toBe(1);
      expect(corpo[0].nome).toBe('Batata Frita');
      expect(corpo[0].categoria).toBe('Petiscos');
    });

    it('Listar produtos com limit=0 ou limit=500 retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resMin = await app.inject({
        method: 'GET',
        url: '/produtos?limit=0',
      });
      expect(resMin.statusCode).toBe(400);
      expect(resMin.json().erro.codigo).toBe('VALIDACAO');

      const resMax = await app.inject({
        method: 'GET',
        url: '/produtos?limit=500',
      });
      expect(resMax.statusCode).toBe(400);
      expect(resMax.json().erro.codigo).toBe('VALIDACAO');
    });
  });

  describe('Busca por ID (GET /produtos/:id)', () => {
    it('Buscar produto por ID existente retorna 200 com preco formatado', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/1',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.nome).toBe('Cerveja');
      expect(corpo.preco).toBe('12.50');
    });

    it('Buscar produto por ID não numérico retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/abc',
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json().erro.codigo).toBe('VALIDACAO');
    });

    it('Buscar produto por ID inexistente retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/999',
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('Atualização Parcial de Produto (PATCH /produtos/:id)', () => {
    it('Atualizar produto com sucesso retorna 200 com novos valores', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date('2026-01-01T10:00:00Z'),
          atualizado_em: new Date('2026-01-01T10:00:00Z'),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {
          preco: '14.00',
          estoque: 25,
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.preco).toBe('14.00');
      expect(corpo.estoque).toBe(25);
    });

    it('Atualizar apenas nome do produto com sucesso retorna 200', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {
          nome: 'Cerveja Lager',
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.nome).toBe('Cerveja Lager');
      expect(corpo.categoria).toBe('Bebidas');
    });

    it('Atualizar apenas categoria do produto com sucesso retorna 200', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {
          categoria: 'Bebidas Especiais',
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.categoria).toBe('Bebidas Especiais');
      expect(corpo.nome).toBe('Cerveja');
    });

    it('Atualizar apenas estoque_minimo com sucesso retorna 200', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {
          estoque_minimo: 10,
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.estoque_minimo).toBe(10);
    });

    it('Atualizar produto sem campos no corpo retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {},
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json().erro.codigo).toBe('VALIDACAO');
    });

    it('Atualizar produto tentando reativação com ativo=true retorna 400 VALIDACAO', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: false,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/1',
        payload: {
          ativo: true,
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes).toHaveProperty('ativo');
      expect(corpo.erro.detalhes.ativo).toBe('Propriedade não permitida.');
    });

    it('Atualizar produto inexistente retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/produtos/999',
        payload: {
          preco: '15.00',
        },
      });

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json().erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('Inativação Idempotente de Produto (POST /produtos/:id/inativar)', () => {
    it('Inativar produto ativo retorna 200 com ativo=false', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma, produtoMock } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/1/inativar',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.ativo).toBe(false);
      expect(produtoMock.update).toHaveBeenCalledTimes(1);
    });

    it('Inativar produto já inativo é idempotente e retorna 200 sem reatualizar', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: false,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma, produtoMock } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/1/inativar',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.ativo).toBe(false);
      expect(produtoMock.update).not.toHaveBeenCalled();
    });

    it('Inativar produto inexistente retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/produtos/999/inativar',
      });

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json().erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('Consulta de Disponibilidade (GET /produtos/:id/disponibilidade)', () => {
    it('Consultar disponibilidade com estoque suficiente retorna 200 com disponivel=true', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade?quantidade=2',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo).toEqual({
        id: 1,
        nome: 'Cerveja',
        preco: '12.50',
        ativo: true,
        estoque: 20,
        disponivel: true,
      });
    });

    it('Consultar disponibilidade omitindo quantidade assume 1 por padrão e avalia estoque', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo).toEqual({
        id: 1,
        nome: 'Cerveja',
        preco: '12.50',
        ativo: true,
        estoque: 20,
        disponivel: true,
      });
    });

    it('Consultar disponibilidade com estoque insuficiente retorna 200 com disponivel=false', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade?quantidade=30',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.disponivel).toBe(false);
      expect(corpo.estoque).toBe(20);
    });

    it('Consultar disponibilidade de produto inativo retorna 200 com disponivel=false', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: false,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];

      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade?quantidade=1',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.ativo).toBe(false);
      expect(corpo.disponivel).toBe(false);
    });

    it('Consultar disponibilidade com quantidade inválida (<=0) retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resZero = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade?quantidade=0',
      });
      expect(resZero.statusCode).toBe(400);
      expect(resZero.json().erro.codigo).toBe('VALIDACAO');

      const resNeg = await app.inject({
        method: 'GET',
        url: '/produtos/1/disponibilidade?quantidade=-2',
      });
      expect(resNeg.statusCode).toBe(400);
      expect(resNeg.json().erro.codigo).toBe('VALIDACAO');
    });

    it('Consultar disponibilidade de produto inexistente retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/produtos/999/disponibilidade?quantidade=1',
      });

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json().erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('Testes Unitários Diretos do Serviço (ServicoProdutosPrisma)', () => {
    it('Lança erro se repositório não estiver configurado', async () => {
      const prismaVazio: ClienteBanco = {
        $queryRaw: vi.fn(),
      };
      const servico = new ServicoProdutosPrisma(prismaVazio);

      await expect(servico.buscarPorId(1)).rejects.toThrow(
        'Repositório de produtos não configurado no cliente do banco.',
      );
    });

    it('Valida quantidade <= 0 diretamente no método consultarDisponibilidade', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const servico = new ServicoProdutosPrisma(prisma);

      await expect(servico.consultarDisponibilidade(1, 0)).rejects.toThrow(
        'A quantidade informada deve ser maior que zero.',
      );
    });

    it('Valida quantidade não inteira ou finita em consultarDisponibilidade', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const servico = new ServicoProdutosPrisma(prisma);

      await expect(servico.consultarDisponibilidade(1, 1.5)).rejects.toThrow(
        'A quantidade informada deve ser maior que zero.',
      );
      await expect(servico.consultarDisponibilidade(1, NaN)).rejects.toThrow(
        'A quantidade informada deve ser maior que zero.',
      );
    });

    it('servico.atualizar lança erro quando nenhum campo é informado', async () => {
      const produtosIniciais: ProdutoSimulado[] = [
        {
          id: 1,
          nome: 'Cerveja',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('12.50'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];
      const { prisma } = criarPrismaComProdutosMock(produtosIniciais);
      const servico = new ServicoProdutosPrisma(prisma);

      await expect(servico.atualizar(1, {})).rejects.toThrow(
        'Ao menos um campo deve ser fornecido para atualização.',
      );
    });

    it('servico.criar valida limites defensivos de tamanho de nome e categoria', async () => {
      const { prisma } = criarPrismaComProdutosMock();
      const servico = new ServicoProdutosPrisma(prisma);

      await expect(
        servico.criar({
          nome: 'a'.repeat(101),
          categoria: 'Bebidas',
          preco: '10.00',
          estoque: 10,
        }),
      ).rejects.toThrow('O nome do produto não pode exceder 100 caracteres.');

      await expect(
        servico.criar({
          nome: 'Cerveja',
          categoria: 'b'.repeat(51),
          preco: '10.00',
          estoque: 10,
        }),
      ).rejects.toThrow('A categoria do produto não pode exceder 50 caracteres.');
    });
  });
});
