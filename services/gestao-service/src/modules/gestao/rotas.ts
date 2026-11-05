import { FastifyPluginAsync } from 'fastify';
import { GestaoController } from './gestao.controller';
import {
  EnvelopeEventoOperacionalSchema,
  RespostaIngestaoEventoSchema,
  ResumoDiarioQuerySchema,
  ResumoDiarioRespostaSchema,
  RankingProdutosQuerySchema,
  RankingProdutosRespostaSchema,
  DesempenhoGarconsRespostaSchema,
  AlertasEstoqueQuerySchema,
  AlertasEstoqueRespostaSchema,
  ExportarRelatorioQuerySchema,
} from './schemas';
import { RespostaErroSchema } from '../../shared/erros';

export interface OpcoesRotasGestao {
  controller: GestaoController;
}

export const rotasGestao: FastifyPluginAsync<OpcoesRotasGestao> = async (app, opts) => {
  const { controller } = opts;

  // Função auxiliar para registrar endpoints tanto em /gestao quanto em /analytics
  const registrarRotasEmPrefixos = (prefixo: string) => {
    // 1. Ingestão de Evento Operacional
    app.post(
      `${prefixo}/eventos`,
      {
        schema: {
          summary: 'Ingestão síncrona de eventos operacionais',
          description: 'Recebe eventos operacionais (comanda.paga, estoque.movimentado, etc.) e processa agregações de forma idempotente.',
          tags: ['Gestão & BI'],
          body: EnvelopeEventoOperacionalSchema,
          response: {
            200: RespostaIngestaoEventoSchema,
            202: RespostaIngestaoEventoSchema,
            400: RespostaErroSchema,
            500: RespostaErroSchema,
          },
        },
      },
      (req, reply) => controller.ingerirEvento(req as any, reply),
    );

    // 2. Resumo Diário
    app.get(
      `${prefixo}/resumo-diario`,
      {
        schema: {
          summary: 'Resumo diário e faturamento',
          description: 'Retorna KPIs consolidados de faturamento, ticket médio e formas de pagamento.',
          tags: ['Gestão & BI'],
          querystring: ResumoDiarioQuerySchema,
          response: {
            200: ResumoDiarioRespostaSchema,
            400: RespostaErroSchema,
            500: RespostaErroSchema,
          },
        },
      },
      (req, reply) => controller.obterResumoDiario(req as any, reply),
    );

    // 3. Ranking de Produtos e Curva ABC
    app.get(
      `${prefixo}/ranking-produtos`,
      {
        schema: {
          summary: 'Ranking de produtos e Curva ABC',
          description: 'Retorna os produtos mais vendidos ordenados por receita com classificação na Curva ABC 80/15/5.',
          tags: ['Gestão & BI'],
          querystring: RankingProdutosQuerySchema,
          response: {
            200: RankingProdutosRespostaSchema,
            400: RespostaErroSchema,
            500: RespostaErroSchema,
          },
        },
      },
      (req, reply) => controller.obterRankingProdutos(req as any, reply),
    );

    // 4. Desempenho e Comissões de Garçons
    app.get(
      `${prefixo}/desempenho-garcons`,
      {
        schema: {
          summary: 'Desempenho e comissões da equipe',
          description: 'Retorna o total de vendas e comissão (10%) geradas por garçom.',
          tags: ['Gestão & BI'],
          response: {
            200: DesempenhoGarconsRespostaSchema,
            500: RespostaErroSchema,
          },
        },
      },
      (req, reply) => controller.obterDesempenhoGarcons(req, reply),
    );

    // 5. Alertas de Estoque Baixo
    app.get(
      `${prefixo}/alertas-estoque`,
      {
        schema: {
          summary: 'Alertas de estoque baixo e zerado',
          description: 'Lista produtos cujo estoque atingiu ou ficou abaixo do estoque mínimo.',
          tags: ['Gestão & BI'],
          querystring: AlertasEstoqueQuerySchema,
          response: {
            200: AlertasEstoqueRespostaSchema,
            500: RespostaErroSchema,
          },
        },
      },
      (req, reply) => controller.obterAlertasEstoque(req as any, reply),
    );

    // 6. Exportação de Relatórios
    app.get(
      `${prefixo}/exportar`,
      {
        schema: {
          summary: 'Exportação de relatórios (CSV ou JSON)',
          description: 'Exporta dados consolidados em formato CSV (RFC 4180) ou JSON para fechamento e auditoria.',
          tags: ['Gestão & BI'],
          querystring: ExportarRelatorioQuerySchema,
          produces: ['text/csv', 'application/json'],
        },
      },
      (req, reply) => controller.exportarRelatorio(req as any, reply),
    );
  };

  // Registra no caminho canônico /gestao
  registrarRotasEmPrefixos('/gestao');
  // Registra no alias compatível /analytics
  registrarRotasEmPrefixos('/analytics');
};
