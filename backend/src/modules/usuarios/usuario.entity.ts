import { PerfilUsuarioTipo } from './schemas';

export type { PerfilUsuarioTipo };

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

export interface CriarUsuarioDados {
  nome: string;
  perfil: PerfilUsuarioTipo;
}

export interface AtualizarUsuarioDados {
  nome?: string;
  perfil?: PerfilUsuarioTipo;
}
