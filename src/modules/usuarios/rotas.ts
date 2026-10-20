import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { RespostaErroSchema } from '../../shared/erros';
import {
  AtualizarUsuarioBodySchema,
  CriarUsuarioBodySchema,
  ListarUsuariosQuerySchema,
  UsuarioIdParamsSchema,
  UsuarioRespostaSchema,
  ValidarGarcomRespostaSchema,
} from './schemas';
import { ServicoUsuarios, UsuarioEntidade } from './servico';

export interface OpcoesRotasUsuarios {
  servico: ServicoUsuarios;
}

function serializarUsuario(usuario: UsuarioEntidade) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil,
    ativo: usuario.ativo,
    criado_em:
      usuario.criado_em instanceof Date
        ? usuario.criado_em.toISOString()
        : String(usuario.criado_em),
    atualizado_em:
      usuario.atualizado_em instanceof Date
        ? usuario.atualizado_em.toISOString()
        : String(usuario.atualizado_em),
  };
}

export const rotasUsuarios: FastifyPluginAsync<OpcoesRotasUsuarios> = async (
  fastify,
  opcoes,
) => {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const servico = opcoes.servico;

  app.post(
    '/usuarios',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Cadastrar novo usuário',
        description: 'Cadastra um novo usuário no sistema com perfil garcom, caixa ou gerente.',
        body: CriarUsuarioBodySchema,
        response: {
          201: UsuarioRespostaSchema,
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const usuario = await servico.criar(request.body);
      return reply.status(201).send(serializarUsuario(usuario));
    },
  );

  app.get(
    '/usuarios',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Listar usuários',
        description: 'Lista usuários com suporte a paginação e filtros opcionais por perfil e situação.',
        querystring: ListarUsuariosQuerySchema,
        response: {
          200: Type.Array(UsuarioRespostaSchema),
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const usuarios = await servico.listar(request.query);
      return reply.send(usuarios.map(serializarUsuario));
    },
  );

  app.get(
    '/usuarios/:id',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Buscar usuário por ID',
        description: 'Retorna os detalhes de um usuário pelo seu identificador único.',
        params: UsuarioIdParamsSchema,
        response: {
          200: UsuarioRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const usuario = await servico.buscarPorId(request.params.id);
      return reply.send(serializarUsuario(usuario));
    },
  );

  app.patch(
    '/usuarios/:id',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Atualizar usuário parcialmente',
        description: 'Atualiza o nome e/ou o perfil de um usuário existente.',
        params: UsuarioIdParamsSchema,
        body: AtualizarUsuarioBodySchema,
        response: {
          200: UsuarioRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const usuario = await servico.atualizar(request.params.id, request.body);
      return reply.send(serializarUsuario(usuario));
    },
  );

  app.post(
    '/usuarios/:id/inativar',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Inativar usuário',
        description: 'Inativa um usuário de forma idempotente, mantendo o histórico no banco de dados.',
        params: UsuarioIdParamsSchema,
        response: {
          200: UsuarioRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const usuario = await servico.inativar(request.params.id);
      return reply.send(serializarUsuario(usuario));
    },
  );

  app.get(
    '/usuarios/:id/validar-garcom',
    {
      schema: {
        tags: ['Usuários'],
        summary: 'Validar garçom ativo (Interna)',
        description:
          'Rota interna para validação de garçom ativo na abertura de comanda. Retorna 200 se válido ou 422 se inexistente, inativo ou perfil inválido.',
        params: UsuarioIdParamsSchema,
        response: {
          200: ValidarGarcomRespostaSchema,
          400: RespostaErroSchema,
          422: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await servico.validarGarcom(request.params.id);
      return reply.send(resultado);
    },
  );
};
