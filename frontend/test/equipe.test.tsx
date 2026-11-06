import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EquipeView } from '../src/features/gestao/components/EquipeView';
import { UsuarioModal } from '../src/features/gestao/components/UsuarioModal';
import { InativarUsuarioDialog } from '../src/features/gestao/components/InativarUsuarioDialog';
import { SideNavGestao } from '../src/features/gestao/components/SideNavGestao';
import { ModoGestaoPage } from '../src/features/gestao/ModoGestaoPage';
import { usuariosApi } from '../src/services/usuarios';
import type { Usuario } from '../src/types/api';

const mockUsuarios: Usuario[] = [
  {
    id: 1,
    nome: 'Carlos Garçom',
    perfil: 'garcom',
    ativo: true,
    criado_em: '2026-11-01T10:00:00.000Z',
    atualizado_em: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 2,
    nome: 'Ana Caixa',
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
    nome: 'Marina Gerente',
    perfil: 'gerente',
    ativo: true,
    criado_em: '2026-11-04T13:00:00.000Z',
    atualizado_em: '2026-11-04T13:00:00.000Z',
  },
  {
    id: 5,
    nome: 'Lucas Antigo',
    perfil: 'garcom',
    ativo: false,
    criado_em: '2026-10-20T08:00:00.000Z',
    atualizado_em: '2026-10-25T08:00:00.000Z',
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Story 2.3.4 — Gestão Frontend: Equipe e Usuários (M12 e M13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Renderização e Listagem da Equipe (M12 — AC-EQ-01)', () => {
    it('deve listar todos os colaboradores cadastrados retornados pela API', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValueOnce(mockUsuarios);

      renderWithQueryClient(<EquipeView />);

      const carlos = await screen.findByText('Carlos Garçom');
      expect(carlos).toBeDefined();
      expect(screen.getByText('Ana Caixa')).toBeDefined();
      expect(screen.getByText('Chef Thiago')).toBeDefined();
      expect(screen.getByText('Marina Gerente')).toBeDefined();
      expect(screen.getByText('Lucas Antigo')).toBeDefined();

      // Verifica os badges de perfil
      expect(screen.getAllByText('Garçom').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Caixa').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cozinha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Gerente').length).toBeGreaterThanOrEqual(1);
    });

    it('deve exibir os contadores de resumo da equipe corretamente', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValueOnce(mockUsuarios);

      renderWithQueryClient(<EquipeView />);

      await screen.findByText('Carlos Garçom');

      // Total = 5, Garçons = 2, Caixas = 1, Cozinha = 1, Gerentes = 1, Inativos = 1
      expect(screen.getByText('Total')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
    });
  });

  describe('2. Filtros e Busca Textual (AC-EQ-04)', () => {
    it('deve filtrar colaboradores ao selecionar o filtro de perfil', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValueOnce(mockUsuarios);

      renderWithQueryClient(<EquipeView />);

      await screen.findByText('Carlos Garçom');

      // Clica no filtro "Cozinha" dentro do grupo de perfil
      const filtroPerfilGroup = screen.getByRole('group', { name: /filtrar por perfil/i });
      const botaoCozinha = within(filtroPerfilGroup).getByRole('button', { name: /^Cozinha$/i });
      fireEvent.click(botaoCozinha);

      // Deve exibir apenas Chef Thiago
      expect(screen.getByText('Chef Thiago')).toBeDefined();
      expect(screen.queryByText('Carlos Garçom')).toBeNull();
      expect(screen.queryByText('Ana Caixa')).toBeNull();
      expect(screen.queryByText('Marina Gerente')).toBeNull();
    });

    it('deve filtrar por status (ativos vs inativos)', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValueOnce(mockUsuarios);

      renderWithQueryClient(<EquipeView />);

      await screen.findByText('Carlos Garçom');

      // Clica no filtro "Inativos"
      const filtroStatusGroup = screen.getByRole('group', { name: /filtrar por status/i });
      const botaoInativos = within(filtroStatusGroup).getByRole('button', { name: /^Inativos$/i });
      fireEvent.click(botaoInativos);

      // Deve exibir apenas Lucas Antigo
      expect(screen.getByText('Lucas Antigo')).toBeDefined();
      expect(screen.queryByText('Carlos Garçom')).toBeNull();
      expect(screen.queryByText('Chef Thiago')).toBeNull();
    });

    it('deve filtrar por busca de texto em tempo real', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValueOnce(mockUsuarios);

      renderWithQueryClient(<EquipeView />);

      await screen.findByText('Carlos Garçom');

      const inputBusca = screen.getByPlaceholderText(/buscar por nome ou id/i);
      fireEvent.change(inputBusca, { target: { value: 'Marina' } });

      expect(screen.getByText('Marina Gerente')).toBeDefined();
      expect(screen.queryByText('Carlos Garçom')).toBeNull();
      expect(screen.queryByText('Ana Caixa')).toBeNull();
    });
  });

  describe('3. Cadastro de Colaborador (M13 — AC-EQ-02 e AC-EQ-05)', () => {
    it('deve validar nome obrigatório impedindo submissão vazia', async () => {
      renderWithQueryClient(
        <UsuarioModal isOpen={true} onClose={vi.fn()} />
      );

      const botaoSalvar = screen.getByRole('button', { name: /cadastrar colaborador/i });
      fireEvent.click(botaoSalvar);

      const erro = await screen.findByText(/o nome do colaborador é obrigatório/i);
      expect(erro).toBeDefined();
    });

    it('deve cadastrar um novo colaborador com perfil selecionado ao enviar formulário válido', async () => {
      const mockNovoUsuario: Usuario = {
        id: 6,
        nome: 'Juliana Caixa',
        perfil: 'caixa',
        ativo: true,
        criado_em: '2026-11-05T14:00:00.000Z',
        atualizado_em: '2026-11-05T14:00:00.000Z',
      };

      const spyCriar = vi.spyOn(usuariosApi, 'criar').mockResolvedValueOnce(mockNovoUsuario);
      const onClose = vi.fn();
      const onSalvo = vi.fn();

      renderWithQueryClient(
        <UsuarioModal
          isOpen={true}
          onClose={onClose}
          onSalvoComSucesso={onSalvo}
        />
      );

      const inputNome = screen.getByPlaceholderText(/ex\.: carlos da silva/i);
      fireEvent.change(inputNome, { target: { value: 'Juliana Caixa' } });

      // Seleciona perfil Caixa
      const radioCaixa = screen.getByRole('radio', { name: /operador de caixa/i });
      fireEvent.click(radioCaixa);

      const botaoSalvar = screen.getByRole('button', { name: /cadastrar colaborador/i });
      fireEvent.click(botaoSalvar);

      await waitFor(() => {
        expect(spyCriar).toHaveBeenCalledWith({
          nome: 'Juliana Caixa',
          perfil: 'caixa',
        });
        expect(onSalvo).toHaveBeenCalledWith(mockNovoUsuario, 'criado');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir mensagem de erro da API quando a criação falhar', async () => {
      vi.spyOn(usuariosApi, 'criar').mockRejectedValueOnce(new Error('Nome de usuário já cadastrado no sistema.'));

      renderWithQueryClient(
        <UsuarioModal isOpen={true} onClose={vi.fn()} />
      );

      const inputNome = screen.getByPlaceholderText(/ex\.: carlos da silva/i);
      fireEvent.change(inputNome, { target: { value: 'Carlos Duplicado' } });

      const botaoSalvar = screen.getByRole('button', { name: /cadastrar colaborador/i });
      fireEvent.click(botaoSalvar);

      const bannerErro = await screen.findByText(/nome de usuário já cadastrado no sistema/i);
      expect(bannerErro).toBeDefined();
    });
  });

  describe('4. Edição de Colaborador', () => {
    it('deve carregar dados existentes no modal e invocar atualizar ao salvar', async () => {
      const usuarioEditando = mockUsuarios[0]; // Carlos Garçom
      const usuarioAtualizado: Usuario = {
        ...usuarioEditando,
        nome: 'Carlos Eduardo Garçom',
      };

      const spyAtualizar = vi.spyOn(usuariosApi, 'atualizar').mockResolvedValueOnce(usuarioAtualizado);
      const onClose = vi.fn();
      const onSalvo = vi.fn();

      renderWithQueryClient(
        <UsuarioModal
          isOpen={true}
          onClose={onClose}
          usuarioParaEditar={usuarioEditando}
          onSalvoComSucesso={onSalvo}
        />
      );

      const inputNome = screen.getByDisplayValue('Carlos Garçom');
      fireEvent.change(inputNome, { target: { value: 'Carlos Eduardo Garçom' } });

      const botaoSalvar = screen.getByRole('button', { name: /salvar alterações/i });
      fireEvent.click(botaoSalvar);

      await waitFor(() => {
        expect(spyAtualizar).toHaveBeenCalledWith(1, {
          nome: 'Carlos Eduardo Garçom',
          perfil: 'garcom',
        });
        expect(onSalvo).toHaveBeenCalledWith(usuarioAtualizado, 'atualizado');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('5. Inativação Lógica de Colaborador (RN14 — AC-EQ-03)', () => {
    it('deve abrir o diálogo de confirmação e inativar o colaborador ao confirmar', async () => {
      const usuarioInativar = mockUsuarios[1]; // Ana Caixa
      const usuarioInativado: Usuario = {
        ...usuarioInativar,
        ativo: false,
      };

      const spyInativar = vi.spyOn(usuariosApi, 'inativar').mockResolvedValueOnce(usuarioInativado);
      const onClose = vi.fn();
      const onInativado = vi.fn();

      renderWithQueryClient(
        <InativarUsuarioDialog
          isOpen={true}
          onClose={onClose}
          usuarioParaInativar={usuarioInativar}
          onInativadoComSucesso={onInativado}
        />
      );

      expect(screen.getByText(/confirmação de inativação lógica/i)).toBeDefined();
      expect(screen.getByText(/ana caixa/i)).toBeDefined();

      const botaoConfirmar = screen.getByRole('button', { name: /confirmar inativação/i });
      fireEvent.click(botaoConfirmar);

      await waitFor(() => {
        expect(spyInativar).toHaveBeenCalledWith(2);
        expect(onInativado).toHaveBeenCalledWith(usuarioInativado);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir mensagem de erro quando a inativação falhar na API', async () => {
      const usuarioInativar = mockUsuarios[1];
      vi.spyOn(usuariosApi, 'inativar').mockRejectedValueOnce(new Error('Falha de conexão com o banco.'));

      renderWithQueryClient(
        <InativarUsuarioDialog
          isOpen={true}
          onClose={vi.fn()}
          usuarioParaInativar={usuarioInativar}
        />
      );

      const botaoConfirmar = screen.getByRole('button', { name: /confirmar inativação/i });
      fireEvent.click(botaoConfirmar);

      const bannerErro = await screen.findByText(/falha de conexão com o banco/i);
      expect(bannerErro).toBeDefined();
    });
  });

  describe('6. Integração com SideNavGestao e ModoGestaoPage', () => {
    it('SideNavGestao deve conter a aba Equipe com sublabel Usuários M12', () => {
      const onAbaChange = vi.fn();

      render(
        <SideNavGestao
          abaAtiva="visao-geral"
          onAbaChange={onAbaChange}
          onAbrirExportacao={vi.fn()}
        />
      );

      const botaoEquipe = screen.getByRole('button', { name: /equipe/i });
      expect(botaoEquipe).toBeDefined();
      expect(screen.getByText('Usuários M12')).toBeDefined();

      fireEvent.click(botaoEquipe);
      expect(onAbaChange).toHaveBeenCalledWith('equipe');
    });

    it('ModoGestaoPage deve renderizar a EquipeView ao alternar para aba equipe', async () => {
      vi.spyOn(usuariosApi, 'listar').mockResolvedValue(mockUsuarios);

      renderWithQueryClient(<ModoGestaoPage />);

      // Clica na aba Equipe na SideNav
      const botaoEquipe = screen.getByRole('button', { name: /equipe/i });
      fireEvent.click(botaoEquipe);

      expect(await screen.findByText('Gestão de Equipe (M12)')).toBeDefined();
      expect(await screen.findByText('Carlos Garçom')).toBeDefined();
    });
  });
});
