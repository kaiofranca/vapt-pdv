import { Static, Type } from '@sinclair/typebox';

export const PerfilUsuarioSchema = Type.Union(
  [
    Type.Literal('garcom'),
    Type.Literal('caixa'),
    Type.Literal('gerente'),
  ],
  { description: 'Perfil de atuação do usuário' },
);

export type PerfilUsuarioTipo = Static<typeof PerfilUsuarioSchema>;

export const UsuarioRespostaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID único do usuário' }),
    nome: Type.String({ description: 'Nome do usuário' }),
    perfil: PerfilUsuarioSchema,
    ativo: Type.Boolean({ description: 'Situação do usuário no sistema' }),
    criado_em: Type.String({ format: 'date-time', description: 'Data de criação em UTC' }),
    atualizado_em: Type.String({ format: 'date-time', description: 'Data da última alteração em UTC' }),
  },
  { description: 'Dados do usuário' },
);

export type UsuarioRespostaTipo = Static<typeof UsuarioRespostaSchema>;

export const CriarUsuarioBodySchema = Type.Object(
  {
    nome: Type.String({ minLength: 1, maxLength: 100, description: 'Nome do usuário' }),
    perfil: PerfilUsuarioSchema,
  },
  { additionalProperties: false, description: 'Dados para cadastro de usuário' },
);

export type CriarUsuarioBodyTipo = Static<typeof CriarUsuarioBodySchema>;

export const ListarUsuariosQuerySchema = Type.Object(
  {
    perfil: Type.Optional(PerfilUsuarioSchema),
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
  { additionalProperties: false, description: 'Filtros e paginação da listagem de usuários' },
);

export type ListarUsuariosQueryTipo = Static<typeof ListarUsuariosQuerySchema>;

export const UsuarioIdParamsSchema = Type.Object(
  {
    id: Type.Integer({ minimum: 1, description: 'ID do usuário' }),
  },
  { additionalProperties: false, description: 'Parâmetro de identificador do usuário' },
);

export type UsuarioIdParamsTipo = Static<typeof UsuarioIdParamsSchema>;

export const AtualizarUsuarioBodySchema = Type.Object(
  {
    nome: Type.Optional(
      Type.String({ minLength: 1, maxLength: 100, description: 'Nome do usuário' }),
    ),
    perfil: Type.Optional(PerfilUsuarioSchema),
  },
  {
    minProperties: 1,
    additionalProperties: false,
    description: 'Campos para atualização parcial do usuário',
  },
);

export type AtualizarUsuarioBodyTipo = Static<typeof AtualizarUsuarioBodySchema>;

export const ValidarGarcomRespostaSchema = Type.Object(
  {
    id: Type.Integer({ description: 'ID do garçom' }),
    nome: Type.String({ description: 'Nome do garçom' }),
    valido: Type.Literal(true, { description: 'Confirmação de garçom válido e ativo' }),
  },
  { description: 'Resultado da validação interna de garçom' },
);

export type ValidarGarcomRespostaTipo = Static<typeof ValidarGarcomRespostaSchema>;
