import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../src/features/auth/LoginPage';
import { App } from '../src/App';
import { useSessionStore } from '../src/stores/useSessionStore';
import { usuariosApi } from '../src/services/usuarios';
import type { Usuario } from '../src/types/api';

const mockUsuarios: Usuario[] = [
  {
    id: 1,
    nome: 'Lucas Garçom',
    perfil: 'garcom',
    ativo: true,
    criado_em: '2026-11-01T10:00:00.000Z',
    atualizado_em: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 2,
    nome: 'Marina Caixa',
    perfil: 'caixa',
    ativo: true,
    criado_em: '2026-11-02T11:00:00.000Z',
    atualizado_em: '2026-11-02T11:00:00.000Z',
  },
  {
    id: 3,
    nome: 'Chef Thiago',
    perfil: 'cozinha',
    ativo: true,
    criado_em: '2026-11-03T12:00:00.000Z',
    atualizado_em: '2026-11-03T12:00:00.000Z',
  },
  {
    id: 4,
    nome: 'Carlos Gerente',
    perfil: 'gerente',
    ativo: true,
    criado_em: '2026-11-04T13:00:00.000Z',
    atualizado_em: '2026-11-04T13:00:00.000Z',
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Story 2.1.6 — KDS Frontend: Habilitação do Perfil Cozinha, Sessão e Rota /kds', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useSessionStore.getState().logout();
    vi.spyOn(usuariosApi, 'listar').mockResolvedValue(mockUsuarios);
  });

  it('AC-KDSLOG-01: deve renderizar a seção de Cozinha e exibir Chef Thiago na tela de login', async () => {
    renderWithClient(<LoginPage />);

    const chef = await screen.findByText('Chef Thiago');
    expect(chef).toBeDefined();
    expect(screen.getByText('Cozinha / KDS')).toBeDefined();
    expect(screen.getByText('Cozinha e Bar (KDS)')).toBeDefined();
  });

  it('AC-KDSLOG-02 & AC-KDSLOG-03: deve autenticar o perfil cozinha, salvar na sessão e mudar o modo para kds', async () => {
    renderWithClient(<LoginPage />);

    const chef = await screen.findByText('Chef Thiago');
    const botaoChef = chef.closest('button');
    expect(botaoChef).not.toBeNull();
    fireEvent.click(botaoChef!);

    const state = useSessionStore.getState();
    expect(state.modo).toBe('kds');
    expect(state.usuarioAtivoId).toBe(3);
    expect(state.nomeOperador).toBe('Chef Thiago');
    expect(state.perfilAtivo).toBe('cozinha');
  });

  it('EARS-AUTH-06 & EARS-AUTH-08: App deve renderizar ModoKdsPage quando modo for kds e voltar ao deslogar', async () => {
    // Configura sessão ativa como cozinha
    useSessionStore.getState().login(mockUsuarios[2]);
    expect(useSessionStore.getState().modo).toBe('kds');

    renderWithClient(<App />);

    // Deve exibir o cabeçalho do KDS
    const kdsLogo = await screen.findByText('KDS');
    expect(kdsLogo).toBeDefined();
    expect(screen.getByText('Painel TV')).toBeDefined();
    expect(screen.getByText(/Chef Thiago/i)).toBeDefined();

    // Clica no botão de logout / sair
    const btnSair = screen.getByTitle('Sair / Trocar Operador');
    fireEvent.click(btnSair);

    // Deve ter voltado para a tela de login
    await screen.findByText('Quem está entrando?');
    expect(useSessionStore.getState().modo).toBe('login');
  });
});
