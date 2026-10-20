import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';
import { PerfilUsuarioTipo } from './schemas';

export interface UsuarioEntidade {
  id: number;
  nome: string;
  perfil: PerfilUsuarioTipo;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

export interface FiltrosListagemUsuarios {
  perfil?: PerfilUsuarioTipo;
  ativo?: boolean;
  limit?: number;
  offset?: number;
}

export interface GarcomValido {
  id: number;
  nome: string;
  valido: true;
}

export interface ServicoUsuarios {
  criar(dados: { nome: string; perfil: PerfilUsuarioTipo }): Promise<UsuarioEntidade>;
  listar(filtros?: FiltrosListagemUsuarios): Promise<UsuarioEntidade[]>;
  buscarPorId(id: number): Promise<UsuarioEntidade>;
  atualizar(
    id: number,
    dados: { nome?: string; perfil?: PerfilUsuarioTipo },
  ): Promise<UsuarioEntidade>;
  inativar(id: number): Promise<UsuarioEntidade>;
  validarGarcom(id: number): Promise<GarcomValido>;
}

export class ServicoUsuariosPrisma implements ServicoUsuarios {
  constructor(private readonly prisma: ClienteBanco) {}

  private obterRepositorio() {
    if (!this.prisma.usuario) {
      throw ErroDominio.interno('Repositório de usuários não configurado no cliente do banco.');
    }
    return this.prisma.usuario;
  }

  async criar(dados: { nome: string; perfil: PerfilUsuarioTipo }): Promise<UsuarioEntidade> {
    const nomeLimpo = dados.nome.trim();
    if (!nomeLimpo) {
      throw ErroDominio.validacao('O nome do usuário não pode ser vazio.', {
        nome: 'O campo não pode ser vazio.',
      });
    }

    const repo = this.obterRepositorio();
    const usuario = await repo.create({
      data: {
        nome: nomeLimpo,
        perfil: dados.perfil,
        ativo: true,
      },
    });

    return usuario as UsuarioEntidade;
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

  async buscarPorId(id: number): Promise<UsuarioEntidade> {
    const repo = this.obterRepositorio();
    const usuario = await repo.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw ErroDominio.naoEncontrado(`Usuário com ID ${id} não encontrado.`, {
        id: 'Usuário não encontrado.',
      });
    }

    return usuario as UsuarioEntidade;
  }

  async atualizar(
    id: number,
    dados: { nome?: string; perfil?: PerfilUsuarioTipo },
  ): Promise<UsuarioEntidade> {
    await this.buscarPorId(id);

    const dadosAtualizacao: { nome?: string; perfil?: PerfilUsuarioTipo } = {};

    if (dados.nome !== undefined) {
      const nomeLimpo = dados.nome.trim();
      if (!nomeLimpo) {
        throw ErroDominio.validacao('O nome do usuário não pode ser vazio.', {
          nome: 'O campo não pode ser vazio.',
        });
      }
      dadosAtualizacao.nome = nomeLimpo;
    }

    if (dados.perfil !== undefined) {
      dadosAtualizacao.perfil = dados.perfil;
    }

    const repo = this.obterRepositorio();
    const usuarioAtualizado = await repo.update({
      where: { id },
      data: dadosAtualizacao,
    });

    return usuarioAtualizado as UsuarioEntidade;
  }

  async inativar(id: number): Promise<UsuarioEntidade> {
    const usuario = await this.buscarPorId(id);

    // Operação idempotente: se já estiver inativo, retorna sem erro
    if (!usuario.ativo) {
      return usuario;
    }

    const repo = this.obterRepositorio();
    const usuarioInativado = await repo.update({
      where: { id },
      data: { ativo: false },
    });

    return usuarioInativado as UsuarioEntidade;
  }

  async validarGarcom(id: number): Promise<GarcomValido> {
    const repo = this.obterRepositorio();
    const usuario = await repo.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw ErroDominio.regraNegocio('GARCOM_INVALIDO', 'Garçom informado não existe no sistema.', {
        motivo: 'USUARIO_NAO_ENCONTRADO',
      });
    }

    if (!usuario.ativo) {
      throw ErroDominio.regraNegocio('GARCOM_INVALIDO', 'O garçom informado está inativo.', {
        motivo: 'USUARIO_INATIVO',
      });
    }

    if (usuario.perfil !== 'garcom') {
      throw ErroDominio.regraNegocio(
        'GARCOM_INVALIDO',
        `O usuário informado possui perfil "${usuario.perfil}", mas a operação exige "garcom".`,
        { motivo: 'PERFIL_INVALIDO' },
      );
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      valido: true,
    };
  }
}
