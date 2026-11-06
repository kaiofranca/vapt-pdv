import { create } from 'zustand';
import type { PerfilUsuario, Usuario } from '../types/api';

export type ModoOperacao = 'login' | 'garcom' | 'caixa' | 'gestao' | 'kds';

interface SessionState {
  modo: ModoOperacao;
  usuarioAtivoId: number | null;
  nomeOperador: string;
  perfilAtivo: PerfilUsuario | null;
  usuarioAtivo: Usuario | null;
  setModo: (modo: ModoOperacao) => void;
  setUsuarioAtivo: (id: number | null, nome?: string, perfil?: PerfilUsuario) => void;
  login: (usuario: Usuario) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  modo: 'login',
  usuarioAtivoId: null,
  nomeOperador: 'Selecione um Operador',
  perfilAtivo: null,
  usuarioAtivo: null,
  setModo: (modo) => set({ modo }),
  setUsuarioAtivo: (usuarioAtivoId, nomeOperador, perfil) =>
    set((state) => ({
      usuarioAtivoId,
      nomeOperador: nomeOperador || state.nomeOperador,
      perfilAtivo: perfil || state.perfilAtivo,
    })),
  login: (usuario) => {
    // Mapeamento exclusivo para os módulos operacionais com suporte ativo no frontend
    const modoPorPerfil: Partial<Record<PerfilUsuario, ModoOperacao>> = {
      garcom: 'garcom',
      caixa: 'caixa',
      gerente: 'gestao',
      cozinha: 'kds',
    };
    const modoDestino = modoPorPerfil[usuario.perfil] || 'login';
    set({
      usuarioAtivo: usuario,
      usuarioAtivoId: usuario.id,
      nomeOperador: usuario.nome,
      perfilAtivo: usuario.perfil,
      modo: modoDestino,
    });
  },
  logout: () =>
    set({
      usuarioAtivo: null,
      usuarioAtivoId: null,
      nomeOperador: 'Selecione um Operador',
      perfilAtivo: null,
      modo: 'login',
    }),
}));
