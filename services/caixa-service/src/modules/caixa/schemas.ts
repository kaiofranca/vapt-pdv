import { Type, Static } from '@sinclair/typebox';

export const ListarComandasQuerySchema = Type.Object(
  {
    status: Type.Optional(
      Type.String({
        description: 'Filtro por status (aguardando_pagamento, parcialmente_paga, paga, cancelada, fechada)',
      }),
    ),
    mesa: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: 'Número da mesa (inteiro positivo)',
      }),
    ),
    busca: Type.Optional(
      Type.String({
        description: 'Termo de busca (número da mesa, nome do garçom ou cliente)',
      }),
    ),
    periodo: Type.Optional(
      Type.String({
        description: 'Filtro temporal (ex: hoje)',
      }),
    ),
  },
  { additionalProperties: false },
);
export type ListarComandasQuery = Static<typeof ListarComandasQuerySchema>;

export const ComandaParamsSchema = Type.Object(
  {
    comandaId: Type.Integer({
      minimum: 1,
      description: 'Identificador único da comanda no salão',
    }),
  },
  { additionalProperties: false },
);
export type ComandaParams = Static<typeof ComandaParamsSchema>;

export const ItemSnapshotInputSchema = Type.Object(
  {
    item_comanda_id: Type.Optional(Type.Integer({ minimum: 1 })),
    id: Type.Optional(Type.Integer({ minimum: 1 })),
    produto_id: Type.Optional(Type.Integer({ minimum: 1 })),
    nome: Type.Optional(Type.String()),
    nome_copiado: Type.Optional(Type.String()),
    preco_unitario: Type.Optional(Type.String()),
    preco_copiado: Type.Optional(Type.String()),
    quantidade: Type.Integer({ minimum: 1 }),
    subtotal: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);
export type ItemSnapshotInput = Static<typeof ItemSnapshotInputSchema>;

export const FecharComandaBodySchema = Type.Object(
  {
    mesa: Type.Optional(Type.Integer({ minimum: 1 })),
    garcom_id: Type.Optional(Type.Integer({ minimum: 1 })),
    garcom_nome: Type.Optional(Type.String()),
    nome_cliente: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    aplicar_taxa_servico: Type.Optional(Type.Boolean()),
    subtotal: Type.Optional(Type.String()),
    taxa_servico: Type.Optional(Type.String()),
    total: Type.Optional(Type.String()),
    itens: Type.Optional(Type.Array(ItemSnapshotInputSchema)),
  },
  { additionalProperties: true },
);
export type FecharComandaBody = Static<typeof FecharComandaBodySchema>;

export const ItemDivisaoInputSchema = Type.Object({
  item_comanda_id: Type.Integer({ minimum: 1 }),
  quantidade: Type.Integer({ minimum: 1 }),
});

export const CotaItensInputSchema = Type.Object({
  rotulo: Type.Optional(Type.String()),
  itens: Type.Array(ItemDivisaoInputSchema, { minItems: 1 }),
});

export const DividirComandaBodySchema = Type.Object(
  {
    modo: Type.Union([Type.Literal('pessoas'), Type.Literal('itens')]),
    pessoas: Type.Optional(Type.Integer({ description: 'Quantidade de pessoas (mínimo 2)' })),
    quantidade_pessoas: Type.Optional(
      Type.Integer({ description: 'Alias de quantidade de pessoas (mínimo 2)' }),
    ),
    cotas: Type.Optional(Type.Array(CotaItensInputSchema)),
    itens_selecionados: Type.Optional(Type.Array(CotaItensInputSchema)),
  },
  { additionalProperties: true },
);
export type DividirComandaBody = Static<typeof DividirComandaBodySchema>;

export const ItemSnapshotRespostaSchema = Type.Object({
  item_comanda_id: Type.Integer(),
  produto_id: Type.Integer(),
  nome: Type.String(),
  preco_unitario: Type.String(),
  quantidade: Type.Integer(),
  subtotal: Type.String(),
});

export const ParcelaRespostaSchema = Type.Object({
  id: Type.Integer(),
  numero_parcela: Type.Integer(),
  pagador_rotulo: Type.Union([Type.String(), Type.Null()]),
  forma_pagamento: Type.String(),
  valor_aplicado: Type.String(),
  valor_recebido: Type.String(),
  troco: Type.String(),
  criado_em: Type.String(),
});

export const ResumoTurnoSchema = Type.Object({
  aguardando_pagamento: Type.Integer(),
  pagas_hoje: Type.Integer(),
  faturamento_turno: Type.String(),
});

export const CobrancaItemResumoSchema = Type.Object({
  id: Type.Integer(),
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  garcom_id: Type.Integer(),
  garcom_nome: Type.Optional(Type.String()),
  nome_cliente: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  aplicar_taxa_servico: Type.Boolean(),
  subtotal: Type.String(),
  taxa_servico: Type.String(),
  total: Type.String(),
  valor_pago: Type.String(),
  saldo_restante: Type.String(),
  pessoas_divisao: Type.Integer(),
  fechada_em: Type.String(),
  paga_em: Type.Union([Type.String(), Type.Null()]),
});

export const ListarComandasRespostaSchema = Type.Object({
  comandas: Type.Array(CobrancaItemResumoSchema),
  resumo_turno: ResumoTurnoSchema,
  aguardando_pagamento: Type.Optional(Type.Integer()),
  pagas_hoje: Type.Optional(Type.Integer()),
  faturamento_turno: Type.Optional(Type.String()),
});

export const CobrancaDetalheRespostaSchema = Type.Object({
  id: Type.Integer(),
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  garcom_id: Type.Integer(),
  garcom_nome: Type.Optional(Type.String()),
  nome_cliente: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  aplicar_taxa_servico: Type.Boolean(),
  subtotal: Type.String(),
  taxa_servico: Type.String(),
  total: Type.String(),
  valor_pago: Type.String(),
  saldo_restante: Type.String(),
  troco_total: Type.String(),
  pessoas_divisao: Type.Integer(),
  modo_divisao: Type.String(),
  itens: Type.Array(ItemSnapshotRespostaSchema),
  parcelas: Type.Array(ParcelaRespostaSchema),
  divisao_detalhes: Type.Optional(Type.Any()),
  cotas: Type.Optional(Type.Array(Type.Any())),
  fechada_em: Type.String(),
  paga_em: Type.Union([Type.String(), Type.Null()]),
});

export const CotaDivididaSchema = Type.Object({
  numero_cota: Type.Integer(),
  rotulo: Type.String(),
  valor: Type.String(),
  saldo: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  subtotal: Type.Optional(Type.String()),
  taxa_servico: Type.Optional(Type.String()),
  itens: Type.Optional(Type.Array(Type.Any())),
});

export const DividirRespostaSchema = Type.Object({
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  modo: Type.String(),
  pessoas: Type.Integer(),
  total_comanda: Type.String(),
  saldo_a_dividir: Type.String(),
  cotas: Type.Array(CotaDivididaSchema),
});

export const PagarComandaBodySchema = Type.Object(
  {
    forma_pagamento: Type.Union([
      Type.Literal('dinheiro'),
      Type.Literal('pix'),
      Type.Literal('cartao'),
    ]),
    valor: Type.Optional(Type.String({ description: 'Valor a ser aplicado no pagamento' })),
    valor_aplicado: Type.Optional(
      Type.String({ description: 'Alias de valor a ser aplicado no pagamento' }),
    ),
    valor_recebido: Type.Optional(
      Type.String({
        description:
          'Valor entregue pelo cliente (obrigatório em dinheiro se diferente do valor aplicado)',
      }),
    ),
    numero_parcela: Type.Optional(
      Type.Integer({ minimum: 1, description: 'Número sequencial da parcela paga' }),
    ),
    pagador_label: Type.Optional(
      Type.String({ description: 'Identificação ou rótulo de quem está pagando' }),
    ),
    pagador_rotulo: Type.Optional(
      Type.String({ description: 'Alias para pagador_label' }),
    ),
    operador_nome: Type.Optional(
      Type.String({ description: 'Nome do operador de caixa' }),
    ),
  },
  { additionalProperties: true },
);
export type PagarComandaBody = Static<typeof PagarComandaBodySchema>;

export const ReciboResumoSchema = Type.Object({
  id: Type.Integer(),
  numero_recibo: Type.Integer(),
  codigo_autenticacao: Type.String(),
  emitido_em: Type.String(),
});

export const PagarComandaRespostaSchema = Type.Object({
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  status: Type.String(),
  aplicar_taxa_servico: Type.Boolean(),
  subtotal: Type.String(),
  taxa_servico: Type.String(),
  total: Type.String(),
  valor_pago: Type.String(),
  saldo_restante: Type.String(),
  troco_total: Type.String(),
  parcela_registrada: ParcelaRespostaSchema,
  recibo: Type.Union([ReciboResumoSchema, Type.Null()]),
  avisos: Type.Array(Type.String()),
});

export const ReciboItemDetalheSchema = Type.Object({
  nome: Type.String(),
  quantidade: Type.Integer(),
  preco_unitario: Type.String(),
  subtotal: Type.String(),
});

export const ReciboPagamentoDetalheSchema = Type.Object({
  numero_parcela: Type.Integer(),
  pagador_rotulo: Type.Union([Type.String(), Type.Null()]),
  forma_pagamento: Type.String(),
  valor_aplicado: Type.String(),
  valor_recebido: Type.String(),
  troco: Type.String(),
});

export const ReciboCompletoRespostaSchema = Type.Object({
  id: Type.Integer(),
  numero_recibo: Type.Integer(),
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  garcom_nome: Type.String(),
  operador_caixa: Type.Optional(Type.String()),
  codigo_autenticacao: Type.String(),
  subtotal: Type.String(),
  taxa_servico: Type.String(),
  total: Type.String(),
  troco_total: Type.String(),
  itens: Type.Array(ReciboItemDetalheSchema),
  pagamentos: Type.Array(ReciboPagamentoDetalheSchema),
  emitido_em: Type.String(),
  paper_text: Type.String(),
});

