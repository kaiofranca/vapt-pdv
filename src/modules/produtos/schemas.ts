import { Static, Type } from '@sinclair/typebox';

export const PrecoEntradaSchema = Type.Union(
  [
    Type.String({
      pattern: '^\\d{1,8}(\\.\\d{1,2})?$',
      description: 'Preço em formato texto com até 8 dígitos inteiros e até 2 casas decimais (ex.: "12.50")',
    }),
    Type.Number({
      minimum: 0,
      maximum: 99999999.99,
      multipleOf: 0.01,
      description: 'Preço em formato numérico não negativo até 99999999.99 com até 2 casas decimais',
    }),
  ],
  { description: 'Preço do produto (string ou número não negativo com até 2 casas decimais e até 8 dígitos inteiros)' },
);

export type PrecoEntradaTipo = Static<typeof PrecoEntradaSchema>;

export const ProdutoRespostaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID único do produto' }),
    nome: Type.String({ description: 'Nome do produto' }),
    categoria: Type.String({ description: 'Categoria do produto' }),
    preco: Type.String({ description: 'Preço unitário formatado com 2 casas decimais (ex.: "12.50")' }),
    estoque: Type.Integer({ description: 'Quantidade atual em estoque' }),
    estoque_minimo: Type.Integer({ description: 'Estoque mínimo de alerta' }),
    ativo: Type.Boolean({ description: 'Situação do produto no cardápio' }),
    criado_em: Type.String({ format: 'date-time', description: 'Data de criação em UTC' }),
    atualizado_em: Type.String({ format: 'date-time', description: 'Data da última alteração em UTC' }),
  },
  { description: 'Dados do produto' },
);

export type ProdutoRespostaTipo = Static<typeof ProdutoRespostaSchema>;

export const CriarProdutoBodySchema = Type.Object(
  {
    nome: Type.String({
      minLength: 1,
      maxLength: 100,
      pattern: '^(?!\\s*$).+',
      description: 'Nome do produto (não vazio e no máx 100 caracteres)',
    }),
    categoria: Type.String({
      minLength: 1,
      maxLength: 50,
      pattern: '^(?!\\s*$).+',
      description: 'Categoria do produto (não vazia e no máx 50 caracteres)',
    }),
    preco: PrecoEntradaSchema,
    estoque: Type.Integer({
      minimum: 0,
      maximum: 2147483647,
      description: 'Quantidade em estoque (inteiro não negativo de 32 bits)',
    }),
    estoque_minimo: Type.Optional(
      Type.Integer({
        minimum: 0,
        maximum: 2147483647,
        default: 0,
        description: 'Estoque mínimo de alerta (padrão 0, inteiro não negativo de 32 bits)',
      }),
    ),
  },
  { additionalProperties: false, description: 'Dados para cadastro de produto' },
);

export type CriarProdutoBodyTipo = Static<typeof CriarProdutoBodySchema>;

export const ListarProdutosQuerySchema = Type.Object(
  {
    categoria: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 50,
        description: 'Filtrar por categoria',
      }),
    ),
    ativo: Type.Optional(Type.Boolean({ description: 'Filtrar por situação ativo/inativo' })),
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
  { additionalProperties: false, description: 'Filtros e paginação da listagem de produtos' },
);

export type ListarProdutosQueryTipo = Static<typeof ListarProdutosQuerySchema>;

export const ProdutoIdParamsSchema = Type.Object(
  {
    id: Type.Integer({ minimum: 1, maximum: 2147483647, description: 'ID do produto' }),
  },
  { additionalProperties: false, description: 'Parâmetro de identificador do produto' },
);

export type ProdutoIdParamsTipo = Static<typeof ProdutoIdParamsSchema>;

export const AtualizarProdutoBodySchema = Type.Object(
  {
    nome: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 100,
        pattern: '^(?!\\s*$).+',
        description: 'Nome do produto',
      }),
    ),
    categoria: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 50,
        pattern: '^(?!\\s*$).+',
        description: 'Categoria do produto',
      }),
    ),
    preco: Type.Optional(PrecoEntradaSchema),
    estoque: Type.Optional(
      Type.Integer({
        minimum: 0,
        maximum: 2147483647,
        description: 'Quantidade em estoque',
      }),
    ),
    estoque_minimo: Type.Optional(
      Type.Integer({
        minimum: 0,
        maximum: 2147483647,
        description: 'Estoque mínimo de alerta',
      }),
    ),
  },
  {
    minProperties: 1,
    additionalProperties: false,
    description: 'Campos para atualização parcial do produto',
  },
);

export type AtualizarProdutoBodyTipo = Static<typeof AtualizarProdutoBodySchema>;

export const ConsultarDisponibilidadeQuerySchema = Type.Object(
  {
    quantidade: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 2147483647,
        default: 1,
        description: 'Quantidade desejada para verificação de estoque (padrão 1, mín 1)',
      }),
    ),
  },
  { additionalProperties: false, description: 'Parâmetros de consulta de disponibilidade' },
);

export type ConsultarDisponibilidadeQueryTipo = Static<typeof ConsultarDisponibilidadeQuerySchema>;

export const DisponibilidadeRespostaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID do produto' }),
    nome: Type.String({ description: 'Nome do produto' }),
    preco: Type.String({ description: 'Preço unitário formatado com 2 casas decimais' }),
    ativo: Type.Boolean({ description: 'Situação do produto' }),
    estoque: Type.Integer({ description: 'Quantidade em estoque atual' }),
    disponivel: Type.Boolean({
      description: 'Indica se produto está ativo e possui estoque suficiente para a quantidade informada',
    }),
  },
  { description: 'Resultado da consulta de disponibilidade de produto' },
);

export type DisponibilidadeRespostaTipo = Static<typeof DisponibilidadeRespostaSchema>;
