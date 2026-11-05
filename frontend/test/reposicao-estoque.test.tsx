import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReporEstoqueModal } from '../src/features/gestao/components/ReporEstoqueModal';
import { EstoqueAlertasView } from '../src/features/gestao/components/EstoqueAlertasView';
import { CardapioView } from '../src/features/gestao/components/CardapioView';
import { produtosApi } from '../src/services/produtos';
import { obterAlertasEstoque } from '../src/services/gestao';
import type { Produto } from '../src/types/api';

vi.mock('../src/services/gestao', () => ({
  obterAlertasEstoque: vi.fn(),
  obterResumoDiario: vi.fn(),
  obterRankingProdutos: vi.fn(),
  obterDesempenhoGarcons: vi.fn(),
  exportarRelatorio: vi.fn(),
}));

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

describe('Story 2.3.6 — Gestão: Reposição de Estoque e Registro de Movimentações (M05 e M06)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. ReporEstoqueModal (M06 — AC-REP-03, EARS-REP-02, EARS-REP-04, EARS-REP-05, EARS-REP-09)', () => {
    const produtoMock = {
      id: 1,
      nome: 'Chopp Artesanal IPA',
      categoria: 'Bebidas',
      estoque: 4,
      estoque_minimo: 10,
    };

    it('deve renderizar dados do produto e calcular sugestão inicial (EARS-REP-04)', () => {
      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={vi.fn()}
          produto={produtoMock}
        />
      );

      expect(screen.getByText('Repor Estoque (M06)')).toBeDefined();
      expect(screen.getByText('Chopp Artesanal IPA')).toBeDefined();
      expect(screen.getByText('4 un')).toBeDefined(); // Estoque atual
      // Sugestão: max(10, 10 * 2 - 4) = 16
      expect(screen.getByText('+16 un')).toBeDefined();
      // Saldo previsto: 4 + 16 = 20 un
      expect(screen.getByText('20 un')).toBeDefined();
    });

    it('deve atualizar o saldo previsto em tempo real ao interagir com o Stepper (EARS-REP-05)', () => {
      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={vi.fn()}
          produto={produtoMock}
        />
      );

      const btnMais = screen.getByRole('button', { name: /aumentar quantidade/i });
      fireEvent.click(btnMais); // 16 + 1 = 17

      expect(screen.getByText('+17 un')).toBeDefined();
      expect(screen.getByText('21 un')).toBeDefined(); // 4 + 17 = 21

      const btnMenos = screen.getByRole('button', { name: /diminuir quantidade/i });
      fireEvent.click(btnMenos); // 17 - 1 = 16
      fireEvent.click(btnMenos); // 16 - 1 = 15

      expect(screen.getByText('+15 un')).toBeDefined();
      expect(screen.getByText('19 un')).toBeDefined(); // 4 + 15 = 19
    });

    it('deve permitir incrementar quantidade através de atalhos rápidos (+10, +20)', () => {
      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={vi.fn()}
          produto={produtoMock}
        />
      );

      // Clica no atalho +20
      const btnMais20 = screen.getByRole('button', { name: /\+20/i });
      fireEvent.click(btnMais20); // 16 + 20 = 36

      expect(screen.getByText('+36 un')).toBeDefined();
      expect(screen.getByText('40 un')).toBeDefined(); // 4 + 36 = 40
    });

    it('deve desabilitar confirmação se a quantidade for menor que 1 (EARS-REP-09, AC-REP-04)', () => {
      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={vi.fn()}
          produto={produtoMock}
        />
      );

      const inputQtd = screen.getByLabelText(/quantidade de reposição/i);
      fireEvent.change(inputQtd, { target: { value: '0' } });

      const btnConfirmar = screen.getByRole('button', { name: /confirmar reposição/i });
      expect(btnConfirmar.hasAttribute('disabled')).toBe(true);
      expect(
        screen.getByText(/a quantidade deve ser um número inteiro maior ou igual a 1/i)
      ).toBeDefined();
    });

    it('deve enviar requisição de reposição com sucesso e disparar callback (EARS-REP-06, EARS-REP-07)', async () => {
      const produtoAtualizado: Produto = {
        id: 1,
        nome: 'Chopp Artesanal IPA',
        categoria: 'Bebidas',
        preco: '18.00',
        estoque: 24,
        estoque_minimo: 10,
        ativo: true,
        criado_em: '2026-11-01T10:00:00.000Z',
        atualizado_em: '2026-11-05T15:00:00.000Z',
      };

      const spyRepor = vi.spyOn(produtosApi, 'repor').mockResolvedValueOnce({
        produto: produtoAtualizado,
        movimento: { id: 1, tipo: 'ENTRADA_REPOSICAO', quantidade: 20 },
      });

      const onClose = vi.fn();
      const onReposto = vi.fn();

      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={onClose}
          produto={produtoMock}
          onRepostoComSucesso={onReposto}
        />
      );

      // Altera quantidade para 20
      const inputQtd = screen.getByLabelText(/quantidade de reposição/i);
      fireEvent.change(inputQtd, { target: { value: '20' } });

      const btnConfirmar = screen.getByRole('button', { name: /confirmar reposição/i });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyRepor).toHaveBeenCalledWith(1, 20, 'ENTRADA_REPOSICAO_MANUAL');
        expect(onReposto).toHaveBeenCalledWith(produtoAtualizado, 20);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve exibir mensagem de erro amigável se a requisição falhar (EARS-REP-12)', async () => {
      vi.spyOn(produtosApi, 'repor').mockRejectedValueOnce(
        new Error('Falha de conexão com o servidor do PDV Core.')
      );

      renderWithQueryClient(
        <ReporEstoqueModal
          isOpen={true}
          onClose={vi.fn()}
          produto={produtoMock}
        />
      );

      const btnConfirmar = screen.getByRole('button', { name: /confirmar reposição/i });
      fireEvent.click(btnConfirmar);

      const alertErro = await screen.findByRole('alert');
      expect(alertErro).toBeDefined();
      expect(within(alertErro).getByText(/falha de conexão com o servidor/i)).toBeDefined();
    });
  });

  describe('2. Integração com EstoqueAlertasView (M05 — EARS-REP-01)', () => {
    it('deve exibir o botão Repor nos cards e abrir o modal M06 ao clicar', async () => {
      vi.mocked(obterAlertasEstoque).mockResolvedValueOnce({
        alertas: [
          {
            produto_id: 10,
            nome_produto: 'Refrigerante Cola Lata',
            categoria: 'Bebidas',
            estoque_atual: 2,
            estoque_minimo: 15,
            nivel: 'baixo',
            ultimo_movimento_em: '2026-11-05T12:00:00.000Z',
          },
        ],
      });

      renderWithQueryClient(<EstoqueAlertasView />);

      expect(await screen.findByText('Refrigerante Cola Lata')).toBeDefined();

      const btnRepor = screen.getByRole('button', {
        name: /repor estoque de refrigerante cola lata/i,
      });
      expect(btnRepor).toBeDefined();

      fireEvent.click(btnRepor);

      // Modal M06 deve abrir com os dados do produto
      expect(await screen.findByText('Repor Estoque (M06)')).toBeDefined();
      expect(screen.getAllByText('Refrigerante Cola Lata').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Integração com CardapioView (M02 — EARS-REP-01)', () => {
    it('deve conter botão de reposição em cada produto abrindo o modal M06', async () => {
      const produtosMock: Produto[] = [
        {
          id: 5,
          nome: 'Água Mineral sem Gás',
          categoria: 'bebida',
          preco: '5.00',
          estoque: 8,
          estoque_minimo: 20,
          ativo: true,
          criado_em: '2026-11-01T10:00:00.000Z',
          atualizado_em: '2026-11-01T10:00:00.000Z',
        },
      ];

      vi.spyOn(produtosApi, 'listar').mockResolvedValue(produtosMock);

      renderWithQueryClient(<CardapioView />);

      expect(await screen.findByText('Água Mineral sem Gás')).toBeDefined();

      const btnRepor = screen.getByRole('button', {
        name: /repor estoque do produto água mineral sem gás/i,
      });
      expect(btnRepor).toBeDefined();

      fireEvent.click(btnRepor);

      expect(await screen.findByText('Repor Estoque (M06)')).toBeDefined();
      expect(screen.getAllByText('Água Mineral sem Gás').length).toBeGreaterThanOrEqual(2);
    });
  });
});
