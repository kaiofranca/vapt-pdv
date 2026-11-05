import type {
  Usuario,
  PerfilUsuario,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  ListarUsuariosFiltros,
} from '../../types/api';

export type {
  Usuario,
  PerfilUsuario,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  ListarUsuariosFiltros,
};

export type FiltroPerfilEquipe = 'todos' | PerfilUsuario;
export type FiltroStatusEquipe = 'todos' | 'ativo' | 'inativo';
