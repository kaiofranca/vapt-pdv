import { Type, Static } from '@sinclair/typebox';

export const EnvelopeEventoOperacionalSchema = Type.Object(
  {
    evento_id: Type.String({ format: 'uuid', description: 'Identificador único do evento (UUID v4)' }),
    evento: Type.String({ description: 'Tipo do evento operacional' }),
    versao: Type.Optional(Type.Union([Type.String(), Type.Integer()], { default: '1.0' })),
    timestamp: Type.Optional(Type.String({ format: 'date-time', description: 'Data/hora de geração do evento' })),
    ocorrido_em: Type.Optional(Type.String({ format: 'date-time', description: 'Data/hora canônica de ocorrência do evento' })),
    data_hora: Type.Optional(Type.String({ description: 'Data/hora UTC ISO do evento operacional' })),

    // Campos opcionais específicos de comanda.paga / comanda.fechada
    comanda_id: Type.Optional(Type.Integer()),
    mesa: Type.Optional(Type.Integer()),
    garcom_id: Type.Optional(Type.Integer()),
    garcom_nome: Type.Optional(Type.String()),
    forma_pagamento: Type.Optional(Type.String()),
    subtotal: Type.Optional(Type.String()),
    valor_subtotal: Type.Optional(Type.String()),
    taxa_servico: Type.Optional(Type.String()),
    total: Type.Optional(Type.String()),
    valor_total: Type.Optional(Type.String()),
    troco: Type.Optional(Type.String()),
    troco_total: Type.Optional(Type.String()),
    paga_em: Type.Optional(Type.String()),
    fechada_em: Type.Optional(Type.String()),
    itens: Type.Optional(
      Type.Array(
        Type.Object({
          produto_id: Type.Integer(),
          nome: Type.Optional(Type.String()),
          nome_copiado: Type.Optional(Type.String()),
          categoria: Type.Optional(Type.String()),
          quantidade: Type.Integer(),
          preco_unitario: Type.Optional(Type.String()),
          preco_copiado: Type.Optional(Type.String()),
          subtotal: Type.Optional(Type.String()),
        }),
      ),
    ),

    // Campos opcionais de item.lancado
    item: Type.Optional(
      Type.Object({
        item_comanda_id: Type.Integer(),
        produto_id: Type.Integer(),
        nome_copiado: Type.String(),
        categoria: Type.String(),
        preco_copiado: Type.String(),
        quantidade: Type.Integer(),
        observacao: Type.Optional(Type.String()),
      }),
    ),

    // Campos opcionais de estoque.movimentado
    movimento_id: Type.Optional(Type.Integer()),
    produto_id: Type.Optional(Type.Integer()),
    nome_produto: Type.Optional(Type.String()),
    categoria: Type.Optional(Type.String()),
    tipo: Type.Optional(Type.String()),
    quantidade: Type.Optional(Type.Integer()),
    estoque_anterior: Type.Optional(Type.Integer()),
    estoque_atual: Type.Optional(Type.Integer()),
    estoque_minimo: Type.Optional(Type.Integer()),
    abaixo_do_minimo: Type.Optional(Type.Boolean()),
  },
  { description: 'Payload universal para ingestão de eventos operacionais' },
);

export type EnvelopeEventoOperacional = Static<typeof EnvelopeEventoOperacionalSchema>;

export const RespostaIngestaoEventoSchema = Type.Object({
  evento_id: Type.String(),
  evento: Type.String(),
  processado: Type.Boolean(),
  duplicado: Type.Boolean(),
  processado_em: Type.String(),
});

export const ResumoDiarioQuerySchema = Type.Object({
  data: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Data YYYY-MM-DD' })),
});

export const ResumoDiarioRespostaSchema = Type.Object({
  data: Type.String(),
  total_vendas: Type.String(),
  total_subtotal: Type.String(),
  total_taxa_servico: Type.String(),
  quantidade_pedidos: Type.Integer(),
  ticket_medio: Type.String(),
  por_forma_pagamento: Type.Object({
    pix: Type.String(),
    cartao: Type.String(),
    dinheiro: Type.String(),
  }),
});

export const RankingProdutosQuerySchema = Type.Object({
  limite: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  categoria: Type.Optional(Type.String()),
});

export const ItemRankingProdutoSchema = Type.Object({
  posicao: Type.Integer(),
  produto_id: Type.Integer(),
  nome_produto: Type.String(),
  categoria: Type.String(),
  quantidade_vendida: Type.Integer(),
  receita_gerada: Type.String(),
  percentual_receita: Type.String(),
  percentual_acumulado: Type.String(),
  classe_abc: Type.Union([Type.Literal('A'), Type.Literal('B'), Type.Literal('C')]),
});

export const RankingProdutosRespostaSchema = Type.Object({
  receita_total_acumulada: Type.String(),
  produtos: Type.Array(ItemRankingProdutoSchema),
});

export const ItemDesempenhoGarcomSchema = Type.Object({
  garcom_id: Type.Integer(),
  garcom_nome: Type.String(),
  comandas_atendidas: Type.Integer(),
  total_vendido: Type.String(),
  comissao_gerada: Type.String(),
  ticket_medio: Type.String(),
});

export const DesempenhoGarconsRespostaSchema = Type.Object({
  garcons: Type.Array(ItemDesempenhoGarcomSchema),
});

export const AlertasEstoqueQuerySchema = Type.Object({
  apenas_ativos: Type.Optional(Type.Boolean({ default: true })),
});

export const ItemAlertaEstoqueSchema = Type.Object({
  produto_id: Type.Integer(),
  nome_produto: Type.String(),
  categoria: Type.String(),
  estoque_atual: Type.Integer(),
  estoque_minimo: Type.Integer(),
  nivel: Type.Union([Type.Literal('baixo'), Type.Literal('zerado')]),
  ultimo_movimento_em: Type.String(),
});

export const AlertasEstoqueRespostaSchema = Type.Object({
  alertas: Type.Array(ItemAlertaEstoqueSchema),
});

export const ExportarRelatorioQuerySchema = Type.Object({
  tipo: Type.Optional(
    Type.Union(
      [
        Type.Literal('faturamento'),
        Type.Literal('produtos'),
        Type.Literal('garcons'),
        Type.Literal('alertas'),
      ],
      { default: 'faturamento' },
    ),
  ),
  formato: Type.Optional(
    Type.Union(
      [
        Type.Literal('csv'),
        Type.Literal('json'),
      ],
      { default: 'csv' },
    ),
  ),
  de: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
  ate: Type.Optional(Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })),
});
