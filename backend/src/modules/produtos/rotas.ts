import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { RespostaErroSchema } from '../../shared/erros';
import {
  AtualizarProdutoBodySchema,
  BaixaEstoqueBodySchema,
  ConsultarDisponibilidadeQuerySchema,
  CriarProdutoBodySchema,
  DisponibilidadeRespostaSchema,
  ListarProdutosQuerySchema,
  ProdutoIdParamsSchema,
  ProdutoRespostaSchema,
} from './schemas';
import { ServicoProdutos } from './produtos.service';
import { ProdutosController } from './produtos.controller';

export interface OpcoesRotasProdutos {
  servico: ServicoProdutos;
  controller?: ProdutosController;
}

export const rotasProdutos: FastifyPluginAsync<OpcoesRotasProdutos> = async (
  fastify,
  opcoes,
) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const controller = opcoes.controller ?? new ProdutosController(opcoes.servico);

  app.post(
    '/produtos',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Criar novo produto',
        description: 'Cadastra um novo produto ativo no cardápio.',
        body: CriarProdutoBodySchema,
        response: {
          201: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => controller.criar(request, reply),
  );

  app.get(
    '/produtos',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Listar produtos do catálogo',
        description: 'Lista produtos com suporte a paginação e filtros opcionais por categoria e ativo.',
        querystring: ListarProdutosQuerySchema,
        response: {
          200: Type.Array(ProdutoRespostaSchema),
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => controller.listar(request, reply),
  );

  app.get(
    '/produtos/:id',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Obter produto por ID',
        description: 'Retorna os detalhes completos de um produto específico.',
        params: ProdutoIdParamsSchema,
        response: {
          200: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => controller.buscarPorId(request, reply),
  );

  app.patch(
    '/produtos/:id',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Atualizar dados do produto',
        description: 'Atualiza parcialmente as informações de um produto existente.',
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
    async (request, reply) => controller.atualizar(request, reply),
  );

  app.post(
    '/produtos/:id/inativar',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Inativar produto do cardápio',
        description: 'Inativa um produto de forma lógica idempotente (ativo=false).',
        params: ProdutoIdParamsSchema,
        response: {
          200: ProdutoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => controller.inativar(request, reply),
  );

  app.get(
    '/produtos/:id/disponibilidade',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Consultar disponibilidade do produto',
        description: 'Verifica se o produto está ativo e possui quantidade em estoque suficiente.',
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
    async (request, reply) => controller.consultarDisponibilidade(request, reply),
  );

  app.post(
    '/produtos/baixa-estoque',
    {
      schema: {
        tags: ['Produtos'],
        summary: 'Baixar estoque de itens',
        description: 'Efetua baixa transacional e idempotente de estoque para uma comanda quitada.',
        body: BaixaEstoqueBodySchema,
        response: {
          200: Type.Object({ status: Type.Literal('ok') }),
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          409: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => controller.baixarEstoque(request, reply),
  );
};
