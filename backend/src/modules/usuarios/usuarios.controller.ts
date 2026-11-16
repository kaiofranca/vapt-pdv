import { FastifyReply, FastifyRequest } from 'fastify';
import {
  AtualizarUsuarioBodyTipo,
  CriarUsuarioBodyTipo,
  ListarUsuariosQueryTipo,
  UsuarioIdParamsTipo,
} from './schemas';
import { ServicoUsuarios } from './usuarios.service';
import { UsuarioEntidade } from './usuario.entity';

export class UsuariosController {
  constructor(private readonly service: ServicoUsuarios) {}

  private serializarUsuario(usuario: UsuarioEntidade) {
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

  async criar(request: FastifyRequest, reply: FastifyReply) {
    const dados = request.body as CriarUsuarioBodyTipo;
    const usuario = await this.service.criar(dados);
    return reply.status(201).send(this.serializarUsuario(usuario));
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const filtros = request.query as ListarUsuariosQueryTipo;
    const usuarios = await this.service.listar(filtros);
    return reply.send(usuarios.map((u) => this.serializarUsuario(u)));
  }

  async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as UsuarioIdParamsTipo;
    const usuario = await this.service.buscarPorId(id);
    return reply.send(this.serializarUsuario(usuario));
  }

  async atualizar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as UsuarioIdParamsTipo;
    const dados = request.body as AtualizarUsuarioBodyTipo;
    const usuario = await this.service.atualizar(id, dados);
    return reply.send(this.serializarUsuario(usuario));
  }

  async inativar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as UsuarioIdParamsTipo;
    const usuario = await this.service.inativar(id);
    return reply.send(this.serializarUsuario(usuario));
  }

  async validarGarcom(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as UsuarioIdParamsTipo;
    const resultado = await this.service.validarGarcom(id);
    return reply.send(resultado);
  }
}
