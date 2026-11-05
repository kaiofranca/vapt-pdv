import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CardapioView } from '../src/features/gestao/components/CardapioView';
import { ProdutoModal } from '../src/features/gestao/components/ProdutoModal';
import { InativarProdutoDialog } from '../src/features/gestao/components/InativarProdutoDialog';
import { SideNavGestao } from '../src/features/gestao/components/SideNavGestao';
import { ModoGestaoPage } from '../src/features/gestao/ModoGestaoPage';
import { produtosApi } from '../src/services/produtos';
import type { Produto } from '../src/types/api';

const mockProdutos: Produto[] = [
  {
    id: 1,
    nome: 'Filé com Fritas',
    categoria: 'comida',
    preco: '45.90',
    estoque: 25,
    estoque_minimo: 10,
    ativo: true,
    criado_em: '2026-11-01T10:00:00.000Z',
    atualizado_em: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 2,
    nome: 'Cerveja Artesanal IPA',
    categoria: 'bebida',
    preco: '18.50',
    estoque: 4,
    estoque_minimo: 10,
    ativo: true,
    criado_em: '2026-11-02T11:00:00.000Z',
    atualizado_em: '2026-11-02T11:00:00.000Z',
  },
  {
    id: 3,
    nome: 'Petit Gâteau',
    categoria: 'sobremesa',
    preco: '22.00',
    estoque: 0,
    estoque_minimo: 5,
    ativo: true,
    criado_em: '2026-11-03T12:00:00.000Z',
    atualizado_em: '2026-11-03T12:00:00.000Z',
  },
  {
    id: 4,
    nome: 'Suco Natural de Laranja',
    categoria: 'bebida',
    preco: '9.00',
    estoque: 50,
    estoque_minimo: 15,
    ativo: true,
    criado_em: '2026-11-04T13:00:00.000Z',
    atualizado_em: '2026-11-04T13:00:00.000Z',
  },
  {
    id: 5,
    nome: 'Porção de Pastel Antiga',
    categoria: 'comida',
    preco: '32.00',
    estoque: 0,
    estoque_minimo: 5,
    ativo: false,
    criado_em: '2026-10-15T08:00:00.000Z',
    atualizado_em: '2026-10-20T08:00:00.000Z',
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

describe('Story 2.3.5 — Gestão Frontend: Cardápio e Gestão de Produtos (M02 e M03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Renderização e Listagem do Cardápio (M02 — AC-PROD-01, EARS-PROD-01, EARS-PROD-02)', () => {
    it('deve listar todos os produtos retornados pela API formatando valores em Real BRL', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);

      expect(await screen.findByText('Filé com Fritas')).toBeDefined();
      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.getByText('Petit Gâteau')).toBeDefined();
      expect(screen.getByText('Suco Natural de Laranja')).toBeDefined();
      expect(screen.getByText('Porção de Pastel Antiga')).toBeDefined();

      // Formatação de valores monetários com R$
      expect(screen.getByText(/45,90/)).toBeDefined();
      expect(screen.getByText(/18,50/)).toBeDefined();
      expect(screen.getByText(/22,00/)).toBeDefined();
    });

    it('deve exibir os contadores de resumo analítico de produtos', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);

      expect(await screen.findByText('Filé com Fritas')).toBeDefined();

      // Contadores: Total = 5, Ativos = 4, Comidas = 2, Bebidas = 2, Estoque Crítico = 2 (id 2 e id 3)
      expect(screen.getByText('5')).toBeDefined(); // Total Produtos
      expect(screen.getByText('4')).toBeDefined(); // Ativos no Salão
    });
  });

  describe('2. Filtros, Busca Textual e Alerta de Estoque (AC-PROD-04, EARS-PROD-03, EARS-PROD-11, EARS-PROD-12, EARS-PROD-13)', () => {
    it('deve filtrar produtos por categoria ao clicar no chip', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);
      expect(await screen.findByText('Filé com Fritas')).toBeDefined();

      // Clica no filtro de Bebidas
      const chipBebidas = screen.getByRole('button', { name: /^bebidas$/i });
      fireEvent.click(chipBebidas);

      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.getByText('Suco Natural de Laranja')).toBeDefined();
      expect(screen.queryByText('Filé com Fritas')).toBeNull();
      expect(screen.queryByText('Petit Gâteau')).toBeNull();
    });

    it('deve filtrar produtos por status (ativos vs inativos)', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);
      expect(await screen.findByText('Filé com Fritas')).toBeDefined();

      // Clica no filtro Inativos
      const btnInativos = screen.getByRole('button', { name: /^inativos$/i });
      fireEvent.click(btnInativos);

      expect(screen.getByText('Porção de Pastel Antiga')).toBeDefined();
      expect(screen.queryByText('Filé com Fritas')).toBeNull();
      expect(screen.queryByText('Suco Natural de Laranja')).toBeNull();
    });

    it('deve filtrar produtos por busca de texto em tempo real', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);
      expect(await screen.findByText('Filé com Fritas')).toBeDefined();

      const inputBusca = screen.getByPlaceholderText(/buscar por nome do produto/i);
      fireEvent.change(inputBusca, { target: { value: 'artesanal' } });

      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.queryByText('Filé com Fritas')).toBeNull();
      expect(screen.queryByText('Petit Gâteau')).toBeNull();
    });

    it('deve destacar produtos com estoque crítico e indicar esgotado quando saldo for 0 (AC-PROD-04)', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<CardapioView />);
      expect(await screen.findByText('Petit Gâteau')).toBeDefined();

      // Petit Gâteau e Porção Antiga têm estoque = 0 -> devem ter badge "Esgotado"
      expect(screen.getAllByText('Esgotado').length).toBe(2);

      // Cerveja Artesanal IPA tem estoque 4 <= min 10 -> alerta visual
      expect(screen.getByText('4 un')).toBeDefined();
    });
  });

  describe('3. Cadastro de Produto (M03 — AC-PROD-02, AC-PROD-05, EARS-PROD-05, EARS-PROD-06, EARS-PROD-14, EARS-PROD-15)', () => {
    it('deve validar nome obrigatório impedindo submissão vazia', async () => {
      renderWithQueryClient(
        <ProdutoModal isOpen={true} onClose={vi.fn()} />
      );

      const btnSalvar = screen.getByRole('button', { name: /cadastrar produto/i });
      fireEvent.click(btnSalvar);

      expect(screen.getByText(/o nome do produto é obrigatório/i)).toBeDefined();
    });

    it('deve validar preço maior que zero impedindo submissão inválida (EARS-PROD-14)', async () => {
      renderWithQueryClient(
        <ProdutoModal isOpen={true} onClose={vi.fn()} />
      );

      const inputNome = screen.getByPlaceholderText(/ex.: filé com fritas/i);
      fireEvent.change(inputNome, { target: { value: 'Refrigerante Cola' } });

      const inputPreco = screen.getByPlaceholderText('0,00');
      fireEvent.change(inputPreco, { target: { value: '0,00' } });

      const btnSalvar = screen.getByRole('button', { name: /cadastrar produto/i });
      fireEvent.click(btnSalvar);

      expect(screen.getByText(/preço deve ser maior que r\$ 0,00/i)).toBeDefined();
    });

    it('deve cadastrar um novo produto com dados válidos convertendo preço para decimal string (AC-PROD-02, RN15)', async () => {
      const novoProduto: Produto = {
        id: 10,
        nome: 'Caipirinha Tradicional',
        categoria: 'bebida',
        preco: '16.00',
        estoque: 30,
        estoque_minimo: 8,
        ativo: true,
        criado_em: '2026-11-05T14:00:00.000Z',
        atualizado_em: '2026-11-05T14:00:00.000Z',
      };

      const spyCriar = vi.spyOn(produtosApi, 'criar').mockResolvedValueOnce(novoProduto);
      const onClose = vi.fn();
      const onSalvo = vi.fn();

      renderWithQueryClient(
        <ProdutoModal
          isOpen={true}
          onClose={onClose}
          onSalvoComSucesso={onSalvo}
        />
      );

      // Preenche nome
      const inputNome = screen.getByPlaceholderText(/ex.: filé com fritas/i);
      fireEvent.change(inputNome, { target: { value: 'Caipirinha Tradicional' } });

      // Seleciona categoria Bebida
      const btnBebida = screen.getByRole('button', { name: /bebida sucos, refrigerantes/i });
      fireEvent.click(btnBebida);

      // Preenche preço (com vírgula)
      const inputPreco = screen.getByPlaceholderText('0,00');
      fireEvent.change(inputPreco, { target: { value: '16,00' } });

      // Preenche estoque
      const inputEstoque = screen.getByPlaceholderText('0');
      fireEvent.change(inputEstoque, { target: { value: '30' } });

      const btnSalvar = screen.getByRole('button', { name: /cadastrar produto/i });
      fireEvent.click(btnSalvar);

      await waitFor(() => {
        expect(spyCriar).toHaveBeenCalledWith({
          nome: 'Caipirinha Tradicional',
          categoria: 'bebida',
          preco: '16.00',
          estoque: 30,
          estoque_minimo: 5,
        });
        expect(onSalvo).toHaveBeenCalledWith(novoProduto, 'criado');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir mensagem de erro da API sem perder os dados preenchidos no modal (EARS-PROD-15)', async () => {
      vi.spyOn(produtosApi, 'criar').mockRejectedValueOnce(
        new Error('Já existe um produto ativo com este nome.')
      );

      renderWithQueryClient(
        <ProdutoModal isOpen={true} onClose={vi.fn()} />
      );

      const inputNome = screen.getByPlaceholderText(/ex.: filé com fritas/i);
      fireEvent.change(inputNome, { target: { value: 'Filé com Fritas' } });

      const inputPreco = screen.getByPlaceholderText('0,00');
      fireEvent.change(inputPreco, { target: { value: '45.90' } });

      const btnSalvar = screen.getByRole('button', { name: /cadastrar produto/i });
      fireEvent.click(btnSalvar);

      const alertErro = await screen.findByRole('alert');
      expect(alertErro).toBeDefined();
      expect(within(alertErro).getByText(/já existe um produto ativo com este nome/i)).toBeDefined();

      // Verifica que os campos ainda mantêm os dados
      expect(inputNome).toHaveProperty('value', 'Filé com Fritas');
    });
  });

  describe('4. Edição de Produto (AC-PROD-03, EARS-PROD-07, EARS-PROD-08)', () => {
    it('deve carregar dados existentes no modal e invocar atualizar com novo preço', async () => {
      const produtoExistente = mockProdutos[0];
      const produtoAtualizado: Produto = {
        ...produtoExistente,
        preco: '49.90',
      };

      const spyAtualizar = vi.spyOn(produtosApi, 'atualizar').mockResolvedValueOnce(produtoAtualizado);
      const onClose = vi.fn();
      const onSalvo = vi.fn();

      renderWithQueryClient(
        <ProdutoModal
          isOpen={true}
          onClose={onClose}
          produtoParaEditar={produtoExistente}
          onSalvoComSucesso={onSalvo}
        />
      );

      expect(screen.getByText('Editar Produto (M03)')).toBeDefined();

      // Altera preço de 45,90 para 49,90
      const inputPreco = screen.getByPlaceholderText('0,00');
      fireEvent.change(inputPreco, { target: { value: '49,90' } });

      const btnSalvar = screen.getByRole('button', { name: /salvar alterações/i });
      fireEvent.click(btnSalvar);

      await waitFor(() => {
        expect(spyAtualizar).toHaveBeenCalledWith(1, {
          nome: 'Filé com Fritas',
          categoria: 'comida',
          preco: '49.90',
          estoque: 25,
          estoque_minimo: 10,
        });
        expect(onSalvo).toHaveBeenCalledWith(produtoAtualizado, 'atualizado');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('5. Inativação Lógica de Produto (RN14 — EARS-PROD-09, EARS-PROD-10)', () => {
    it('deve abrir o diálogo de confirmação e inativar o produto ao confirmar', async () => {
      const produtoInativar = mockProdutos[0];
      const produtoInativado: Produto = { ...produtoInativar, ativo: false };
      const spyInativar = vi.spyOn(produtosApi, 'inativar').mockResolvedValueOnce(produtoInativado);
      const onClose = vi.fn();
      const onInativado = vi.fn();

      renderWithQueryClient(
        <InativarProdutoDialog
          isOpen={true}
          onClose={onClose}
          produtoParaInativar={produtoInativar}
          onInativadoComSucesso={onInativado}
        />
      );

      expect(screen.getByText(/confirmação de inativação lógica/i)).toBeDefined();
      expect(screen.getByText(/filé com fritas/i)).toBeDefined();

      const botaoConfirmar = screen.getByRole('button', { name: /confirmar inativação/i });
      fireEvent.click(botaoConfirmar);

      await waitFor(() => {
        expect(spyInativar).toHaveBeenCalledWith(1);
        expect(onInativado).toHaveBeenCalledWith(produtoInativado);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir mensagem de erro quando a inativação falhar na API', async () => {
      const produtoInativar = mockProdutos[1];
      vi.spyOn(produtosApi, 'inativar').mockRejectedValueOnce(new Error('Falha de conexão com o banco.'));

      renderWithQueryClient(
        <InativarProdutoDialog
          isOpen={true}
          onClose={vi.fn()}
          produtoParaInativar={produtoInativar}
        />
      );

      const botaoConfirmar = screen.getByRole('button', { name: /confirmar inativação/i });
      fireEvent.click(botaoConfirmar);

      const bannerErro = await screen.findByText(/falha de conexão com o banco/i);
      expect(bannerErro).toBeDefined();
    });
  });

  describe('6. Integração com SideNavGestao e ModoGestaoPage (EARS-PROD-01, EARS-PROD-04)', () => {
    it('SideNavGestao deve conter a aba Cardápio com sublabel Produtos M02', () => {
      const onAbaChange = vi.fn();

      render(
        <SideNavGestao
          abaAtiva="visao-geral"
          onAbaChange={onAbaChange}
          onAbrirExportacao={vi.fn()}
        />
      );

      const botaoCardapio = screen.getByRole('button', { name: /cardápio/i });
      expect(botaoCardapio).toBeDefined();
      expect(screen.getByText('Produtos M02')).toBeDefined();

      fireEvent.click(botaoCardapio);
      expect(onAbaChange).toHaveBeenCalledWith('cardapio');
    });

    it('ModoGestaoPage deve renderizar a CardapioView ao alternar para aba cardapio', async () => {
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(mockProdutos);

      renderWithQueryClient(<ModoGestaoPage />);

      // Clica na aba Cardápio na SideNav
      const botaoCardapio = screen.getByRole('button', { name: /cardápio/i });
      fireEvent.click(botaoCardapio);

      expect(await screen.findByText('Cardápio & Produtos (M02)')).toBeDefined();
      expect(await screen.findByText('Filé com Fritas')).toBeDefined();
    });
  });
});
