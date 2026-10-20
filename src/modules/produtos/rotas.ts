import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { RespostaErroSchema } from '../../shared/erros';
import {
  AtualizarProdutoBodySchema,
  ConsultarDisponibilidadeQuerySchema,
  CriarProdutoBodySchema,
  DisponibilidadeRespostaSchema,
  ListarProdutosQuerySchema,
  ProdutoIdParamsSchema,
  ProdutoRespostaSchema,
} from './schemas';
import { ProdutoEntidade, ServicoProdutos } from './servico';

export interface OpcoesRotasProdutos {
  servico: ServicoProdutos;
}

function serializarProduto(produto: ProdutoEntidade) {
  return {
    id: produto.id,
    nome: produto.nome,
    categoria: produto.categoria,
    preco: produto.preco,
    estoque: produto.estoque,
    estoque_minimo: produto.estoque_minimo,
    ativo: produto.ativo,
    criado_em:
      produto.criado_em instanceof Date
        ? produto.criado_em.toISOString()
        : String(produto.criado_em),
    atualizado_em:
      produto.atualizado_em instanceof Date
        ? produto.atualizado_em.toISOString()
        : String(produto.atualizado_em),
  };
}

export const rotasProdutos: FastifyPluginAsync<OpcoesRotasProdutos> = async (
  fastify,
  opcoes,
) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const servico = opcoes.servico;

  app.post(
    '/produtos',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Cadastrar novo produto',
        description: 'Cadastra um novo produto no cardápio com estoque e preço.',
        body: CriarProdutoBodySchema,
        response: {
          201: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const produto = await servico.criar(request.body);
      return reply.status(201).send(serializarProduto(produto));
    },
  );

  app.get(
    '/produtos',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Listar produtos',
        description:
          'Lista produtos com suporte a paginação e filtros opcionais por categoria e situação ativo/inativo.',
        querystring: ListarProdutosQuerySchema,
        response: {
          200: Type.Array(ProdutoRespostaSchema),
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const produtos = await servico.listar(request.query);
      return reply.send(produtos.map(serializarProduto));
    },
  );

  app.get(
    '/produtos/:id',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Buscar produto por ID',
        description: 'Retorna os detalhes de um produto pelo seu identificador único.',
        params: ProdutoIdParamsSchema,
        response: {
          200: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const produto = await servico.buscarPorId(request.params.id);
      return reply.send(serializarProduto(produto));
    },
  );

  app.patch(
    '/produtos/:id',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Atualizar produto parcialmente',
        description: 'Atualiza campos de um produto existente (nome, categoria, preço, estoque, estoque mínimo).',
        params: ProdutoIdParamsSchema,
        body: AtualizarProdutoBodySchema,
        response: {
          200: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const produto = await servico.atualizar(request.params.id, request.body);
      return reply.send(serializarProduto(produto));
    },
  );

  app.post(
    '/produtos/:id/inativar',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Inativar produto',
        description: 'Inativa um produto de forma idempotente, mantendo o histórico no banco de dados.',
        params: ProdutoIdParamsSchema,
        response: {
          200: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const produto = await servico.inativar(request.params.id);
      return reply.send(serializarProduto(produto));
    },
  );

  app.get(
    '/produtos/:id/disponibilidade',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Consultar disponibilidade do produto (Interna)',
        description:
          'Rota interna para validar disponibilidade de estoque e congelar dados de produto para lançamento em comanda.',
        params: ProdutoIdParamsSchema,
        querystring: ConsultarDisponibilidadeQuerySchema,
        response: {
          200: DisponibilidadeRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const quantidade = request.query.quantidade ?? 1;
      const resultado = await servico.consultarDisponibilidade(
        request.params.id,
        quantidade,
      );
      return reply.send(resultado);
    },
  );
};
