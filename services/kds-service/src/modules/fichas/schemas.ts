import { Type, Static } from '@sinclair/typebox';

export const CriarFichaSchema = Type.Object(
  {
    comanda_id: Type.Integer({ minimum: 1, description: 'ID lógico da comanda' }),
    item_comanda_id: Type.Integer({ minimum: 1, description: 'ID único do item da comanda (idempotência)' }),
    produto_id: Type.Integer({ minimum: 1, description: 'ID do produto' }),
    mesa: Type.Integer({ minimum: 1, description: 'Número da mesa (inteiro positivo)' }),
    garcom_id: Type.Integer({ minimum: 1, description: 'ID do garçom solicitante' }),
    garcom_nome: Type.Optional(Type.String({ maxLength: 120, description: 'Nome do garçom' })),
    nome_garcom: Type.Optional(Type.String({ maxLength: 120, description: 'Alias para garcom_nome' })),
    nome_produto: Type.String({ minLength: 1, maxLength: 140, description: 'Nome descritivo do produto' }),
    estacao: Type.Optional(
      Type.Union([Type.Literal('cozinha'), Type.Literal('bar')], {
        description: 'Estação de preparo (cozinha ou bar)',
      }),
    ),
    setor: Type.Optional(
      Type.Union([Type.Literal('cozinha'), Type.Literal('bar')], {
        description: 'Alias de estacao para compatibilidade',
      }),
    ),
    quantidade: Type.Integer({ minimum: 1, description: 'Quantidade do item (> 0)' }),
    observacao: Type.Optional(Type.Union([Type.String({ maxLength: 240 }), Type.Null()])),
  },
  { description: 'Payload para criação de ficha de preparo no KDS' },
);

export type CriarFichaInput = Static<typeof CriarFichaSchema>;

export const FichaRespostaSchema = Type.Object(
  {
    id: Type.Integer(),
    comanda_id: Type.Integer(),
    item_comanda_id: Type.Integer(),
    produto_id: Type.Integer(),
    mesa: Type.Integer(),
    garcom_nome: Type.Union([Type.String(), Type.Null()]),
    nome_produto: Type.String(),
    estacao: Type.String(),
    quantidade: Type.Integer(),
    observacao: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    recebido_em: Type.String(),
    iniciado_em: Type.Union([Type.String(), Type.Null()]),
    pronto_em: Type.Union([Type.String(), Type.Null()]),
    entregue_em: Type.Union([Type.String(), Type.Null()]),
    cancelado_em: Type.Union([Type.String(), Type.Null()]),
  },
  { description: 'Representação pública da ficha de preparo' },
);

export type FichaResposta = Static<typeof FichaRespostaSchema>;

// Story 14.4: Transições de status
export const StatusFichaEnum = Type.Union([
  Type.Literal('recebido'),
  Type.Literal('em_preparo'),
  Type.Literal('pronto'),
  Type.Literal('entregue'),
  Type.Literal('cancelado'),
]);

export type StatusFicha = Static<typeof StatusFichaEnum>;

export const AtualizarStatusFichaSchema = Type.Object(
  {
    status: StatusFichaEnum,
    alterado_por: Type.Optional(Type.String({ maxLength: 120 })),
  },
  { description: 'Payload para transição de status da ficha' },
);

export type AtualizarStatusFichaInput = Static<typeof AtualizarStatusFichaSchema>;

export const ParamsFichaIdSchema = Type.Object({
  id: Type.Integer({ minimum: 1, description: 'ID da ficha de preparo' }),
});

// Story 14.5: Consulta de pendências por comanda
export const ParamsComandaIdSchema = Type.Object({
  comandaId: Type.Integer({ minimum: 1, description: 'ID da comanda' }),
});

export const ItemPendenciaSchema = Type.Object({
  ficha_id: Type.Integer(),
  item_comanda_id: Type.Integer(),
  nome_produto: Type.String(),
  quantidade: Type.Integer(),
  estacao: Type.String(),
  status: Type.String(),
});

export type ItemPendencia = Static<typeof ItemPendenciaSchema>;

export const RespostaPendenciasComandaSchema = Type.Object({
  comanda_id: Type.Integer(),
  mesa: Type.Integer(),
  possui_pendencias: Type.Boolean(),
  totais: Type.Object({
    recebido: Type.Integer(),
    em_preparo: Type.Integer(),
    pronto: Type.Integer(),
    entregue: Type.Integer(),
    cancelado: Type.Integer(),
  }),
  itens: Type.Array(ItemPendenciaSchema),
});

export type RespostaPendenciasComanda = Static<typeof RespostaPendenciasComandaSchema>;


