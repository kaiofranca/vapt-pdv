import { Static, Type } from '@sinclair/typebox';

export const StatusComandaSchema = Type.Union(
  [
    Type.Literal('aberta'),
    Type.Literal('fechada'),
    Type.Literal('paga'),
    Type.Literal('cancelada'),
  ],
  { description: 'Status atual da comanda' },
);

export type StatusComandaTipo = Static<typeof StatusComandaSchema>;

export const FormaPagamentoSchema = Type.Union(
  [
    Type.Literal('dinheiro'),
    Type.Literal('pix'),
    Type.Literal('cartao'),
  ],
  { description: 'Forma de pagamento da comanda' },
);

export type FormaPagamentoTipo = Static<typeof FormaPagamentoSchema>;

export const ItemComandaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID único do item da comanda' }),
    produto_id: Type.Integer({ description: 'ID do produto referenciado' }),
    nome_copiado: Type.String({
      description: 'Nome do produto congelado no momento do lançamento',
    }),
    preco_copiado: Type.String({
      description: 'Preço unitário congelado formatado com 2 casas decimais (ex.: "12.50")',
    }),
    quantidade: Type.Integer({ description: 'Quantidade lançada do item' }),
  },
  { description: 'Item pertencente a uma comanda' },
);

export type ItemComandaTipo = Static<typeof ItemComandaSchema>;

export const ComandaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID único da comanda' }),
    mesa: Type.String({ description: 'Identificador ou número da mesa' }),
    nome_cliente: Type.Union([Type.String(), Type.Null()], {
      description: 'Nome do cliente (opcional)',
    }),
    garcom_id: Type.Integer({ description: 'ID do garçom responsável pela abertura' }),
    status: StatusComandaSchema,
    subtotal: Type.Union([Type.String(), Type.Null()], {
      description: 'Subtotal dos itens formatado com 2 casas decimais (null enquanto aberta)',
    }),
    taxa_servico: Type.Union([Type.String(), Type.Null()], {
      description: 'Valor da taxa de serviço de 10% formatado com 2 casas decimais (null enquanto aberta)',
    }),
    total: Type.Union([Type.String(), Type.Null()], {
      description: 'Valor total da comanda formatado com 2 casas decimais (null enquanto aberta)',
    }),
    forma_pagamento: Type.Union([FormaPagamentoSchema, Type.Null()], {
      description: 'Forma de pagamento registrada (null até o pagamento)',
    }),
    aberta_em: Type.String({
      format: 'date-time',
      description: 'Data e hora de abertura da comanda em UTC',
    }),
    fechada_em: Type.Union([Type.String({ format: 'date-time' }), Type.Null()], {
      description: 'Data e hora de fechamento da comanda em UTC (null enquanto não fechada)',
    }),
    paga_em: Type.Union([Type.String({ format: 'date-time' }), Type.Null()], {
      description: 'Data e hora de pagamento da comanda em UTC (null enquanto não paga)',
    }),
    itens: Type.Array(ItemComandaSchema, {
      description: 'Itens lançados na comanda',
    }),
    integracao_caixa_pendente: Type.Optional(
      Type.Boolean({
        description: 'Indica se a sincronização com o caixa-service falhou e está pendente',
      }),
    ),
    integracao_gestao_pendente: Type.Optional(
      Type.Boolean({
        description: 'Indica se a sincronização com o gestao-service falhou e está pendente',
      }),
    ),
    avisos: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Lista de avisos operacionais, como falha de sincronização com satélites',
      }),
    ),
  },
  { description: 'Dados completos da comanda' },
);

export type ComandaTipo = Static<typeof ComandaSchema>;

export const MesaEntradaSchema = Type.Union(
  [
    Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'Número da mesa (inteiro >= 1)',
    }),
    Type.String({
      minLength: 1,
      pattern:
        '^\\s*(?!$)(?![+-]?(?:0+(?:\\.\\d+)?|\\d+\\.\\d+)\\s*$)(?!-\\d+\\s*$)\\S(?:.{0,48}\\S)?\\s*$',
      description: 'Identificador da mesa em texto não vazio (máx. 50 caracteres após trim)',
    }),
  ],
  { description: 'Identificador ou número da mesa' },
);

export type MesaEntradaTipo = Static<typeof MesaEntradaSchema>;

export const CriarComandaBodySchema = Type.Object(
  {
    mesa: MesaEntradaSchema,
    garcom_id: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'ID do garçom responsável pela mesa',
    }),
    nome_cliente: Type.Optional(
      Type.Union(
        [
          Type.String({
            pattern: '^\\s*(?:\\S(?:.{0,98}\\S)?)?\\s*$',
            description: 'Nome opcional do cliente (máx. 100 caracteres após trim)',
          }),
          Type.Null(),
        ],
        { description: 'Nome opcional do cliente' },
      ),
    ),
  },
  { additionalProperties: false, description: 'Dados para abertura de comanda' },
);

export type CriarComandaBodyTipo = Static<typeof CriarComandaBodySchema>;

export const ListarComandasQuerySchema = Type.Object(
  {
    status: Type.Optional(StatusComandaSchema),
    mesa: Type.Optional(
      Type.String({
        minLength: 1,
        pattern: '^\\s*\\S(?:.{0,48}\\S)?\\s*$',
        description: 'Filtrar pelo identificador da mesa',
      }),
    ),
    de: Type.Optional(
      Type.String({
        minLength: 1,
        description: 'Data/hora inicial (ISO 8601) sobre aberta_em',
      }),
    ),
    ate: Type.Optional(
      Type.String({
        minLength: 1,
        description: 'Data/hora final (ISO 8601) sobre aberta_em',
      }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 200,
        default: 50,
        description: 'Limite de registros (padrão 50, máx 200)',
      }),
    ),
    offset: Type.Optional(
      Type.Integer({
        minimum: 0,
        default: 0,
        description: 'Deslocamento da listagem para paginação',
      }),
    ),
  },
  { additionalProperties: false, description: 'Filtros e paginação da listagem de comandas' },
);

export type ListarComandasQueryTipo = Static<typeof ListarComandasQuerySchema>;

export const ParametroIdComandaSchema = Type.Object(
  {
    id: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'ID único da comanda',
    }),
  },
  { additionalProperties: false, description: 'Parâmetro de identificador da comanda' },
);

export type ParametroIdComandaTipo = Static<typeof ParametroIdComandaSchema>;

export const LancarItemBodySchema = Type.Object(
  {
    produto_id: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'ID do produto a ser lançado na comanda',
    }),
    quantidade: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'Quantidade do produto a ser lançada (inteiro >= 1)',
    }),
  },
  { additionalProperties: false, description: 'Dados para lançamento de item na comanda' },
);

export type LancarItemBodyTipo = Static<typeof LancarItemBodySchema>;

export const AjustarItemBodySchema = Type.Object(
  {
    quantidade: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'Nova quantidade total do item (inteiro >= 1)',
    }),
  },
  { additionalProperties: false, description: 'Dados para ajuste de quantidade do item' },
);

export type AjustarItemBodyTipo = Static<typeof AjustarItemBodySchema>;

export const FecharComandaBodySchema = Type.Object(
  {
    aplicar_taxa_servico: Type.Boolean({
      description: 'Indica se a taxa de serviço de 10% deve ser aplicada',
    }),
  },
  { additionalProperties: false, description: 'Dados para fechamento da comanda' },
);

export type FecharComandaBodyTipo = Static<typeof FecharComandaBodySchema>;

export const ParametroItemComandaSchema = Type.Object(
  {
    id: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'ID único da comanda',
    }),
    itemId: Type.Integer({
      minimum: 1,
      maximum: 2147483647,
      description: 'ID único do item da comanda',
    }),
  },
  { additionalProperties: false, description: 'Parâmetros de identificação de comanda e item' },
);

export type ParametroItemComandaTipo = Static<typeof ParametroItemComandaSchema>;

export const PagarComandaBodySchema = Type.Object(
  {
    forma_pagamento: FormaPagamentoSchema,
    documento_cliente: Type.Optional(
      Type.Union([
        Type.String({
          minLength: 1,
          maxLength: 50,
          description: 'Documento fiscal opcional do cliente (CPF/CNPJ)',
        }),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false, description: 'Dados para pagamento da comanda' },
);

export type PagarComandaBodyTipo = Static<typeof PagarComandaBodySchema>;
