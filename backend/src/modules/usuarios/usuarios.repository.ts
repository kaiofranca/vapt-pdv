import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';
import {
  FiltrosListagemUsuarios,
  PerfilUsuarioTipo,
  UsuarioEntidade,
} from './usuario.entity';

export interface IUsuariosRepository {
  criar(dados: { nome: string; perfil: PerfilUsuarioTipo; ativo?: boolean }): Promise<UsuarioEntidade>;
  buscarPorId(id: number): Promise<UsuarioEntidade | null>;
  listar(filtros?: FiltrosListagemUsuarios): Promise<UsuarioEntidade[]>;
  atualizar(
    id: number,
    dados: { nome?: string; perfil?: PerfilUsuarioTipo; ativo?: boolean },
  ): Promise<UsuarioEntidade>;
}

export class UsuariosRepositoryPrisma implements IUsuariosRepository {
  constructor(private readonly prisma: ClienteBanco) {}

  private obterRepositorio() {
    if (!this.prisma.usuario) {
      throw ErroDominio.interno('Repositório de usuários não configurado no cliente do banco.');
    }
    return this.prisma.usuario;
  }

  async criar(dados: {
    nome: string;
    perfil: PerfilUsuarioTipo;
    ativo?: boolean;
  }): Promise<UsuarioEntidade> {
    const repo = this.obterRepositorio();
    const usuario = await repo.create({
      data: {
        nome: dados.nome,
        perfil: dados.perfil,
        ativo: dados.ativo ?? true,
      },
    });

    return usuario as UsuarioEntidade;
  }

  async buscarPorId(id: number): Promise<UsuarioEntidade | null> {
    const repo = this.obterRepositorio();
    const usuario = await repo.findUnique({
      where: { id },
    });

    return (usuario as UsuarioEntidade) ?? null;
  }

  async listar(filtros: FiltrosListagemUsuarios = {}): Promise<UsuarioEntidade[]> {
    const limit = Math.min(Math.max(filtros.limit ?? 50, 1), 200);
    const offset = Math.max(filtros.offset ?? 0, 0);

    const where: {
      perfil?: PerfilUsuarioTipo;
      ativo?: boolean;
    } = {};

    if (filtros.perfil !== undefined) {
      where.perfil = filtros.perfil;
    }

    if (filtros.ativo !== undefined) {
      where.ativo = filtros.ativo;
    }

    const repo = this.obterRepositorio();
    const usuarios = await repo.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { id: 'asc' },
    });

    return usuarios as UsuarioEntidade[];
  }

  async atualizar(
    id: number,
    dados: { nome?: string; perfil?: PerfilUsuarioTipo; ativo?: boolean },
  ): Promise<UsuarioEntidade> {
    const repo = this.obterRepositorio();
    const usuarioAtualizado = await repo.update({
      where: { id },
      data: dados,
    });

    return usuarioAtualizado as UsuarioEntidade;
  }
}
