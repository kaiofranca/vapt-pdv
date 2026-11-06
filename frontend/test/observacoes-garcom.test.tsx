import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetObservacao } from '../src/features/garcom/components/BottomSheetObservacao';
import { ProdutoStepperCard } from '../src/features/garcom/components/ProdutoStepperCard';
import { ComandaMesaView } from '../src/features/garcom/components/ComandaMesaView';
import { comandasApi, adicionarItemComanda } from '../src/services/comandas';
import { produtosApi } from '../src/services/produtos';
import { apiClient } from '../src/services/apiClient';
import type { Comanda, Produto } from '../src/types/api';

vi.mock('../src/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    codigo: string;
    detalhes?: Record<string, unknown>;
    constructor(mensagem: string, codigo: string = 'ERRO', detalhes?: Record<string, unknown>) {
      super(mensagem);
      this.codigo = codigo;
      this.detalhes = detalhes;
    }
  },
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

describe('Story 2.1.8 — Core Salão: Observações e Alergias no PWA do Garçom (G04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. BottomSheetObservacao (G04 — EARS-OBS-04, EARS-OBS-07, EARS-OBS-09)', () => {
    it('deve renderizar a Bottom Sheet G04 com título, nome do produto e contador inicial de 240 caracteres', () => {
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Hambúrguer Artesanal"
          onConfirmar={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('G04 · Observação e Alergia')).toBeDefined();
      expect(screen.getByText('Personalizar: Hambúrguer Artesanal')).toBeDefined();
      expect(screen.getByText('240/240 caracteres')).toBeDefined();
      expect(screen.getByText('Sem cebola')).toBeDefined();
      expect(screen.getByText('Ao ponto')).toBeDefined();
    });

    it('deve atualizar o contador regressivo em tempo real ao digitar (EARS-OBS-07)', () => {
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Hambúrguer Artesanal"
          onConfirmar={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText(/Ex.: Sem cebola, carne ao ponto/i);
      fireEvent.change(textarea, { target: { value: 'Sem picles' } });

      // 240 - 10 = 230
      expect(screen.getByText('230/240 caracteres')).toBeDefined();
    });

    it('deve inserir tags rápidas clicáveis anexando ao texto (EARS-OBS-04)', () => {
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Hambúrguer Artesanal"
          onConfirmar={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const btnSemCebola = screen.getByRole('button', { name: 'Sem cebola' });
      fireEvent.click(btnSemCebola);

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(/Ex.: Sem cebola, carne ao ponto/i);
      expect(textarea.value).toBe('Sem cebola');

      // Clicar em outra tag rápida concatena com vírgula
      const btnAoPonto = screen.getByRole('button', { name: 'Ao ponto' });
      fireEvent.click(btnAoPonto);

      expect(textarea.value).toBe('Sem cebola, Ao ponto');
    });

    it('deve limitar estritamente a 240 caracteres e exibir aviso de limite atingido (EARS-OBS-09)', () => {
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Hambúrguer Artesanal"
          onConfirmar={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(/Ex.: Sem cebola, carne ao ponto/i);
      const texto250 = 'A'.repeat(250);
      fireEvent.change(textarea, { target: { value: texto250 } });

      // Deve truncar no limite de 240
      expect(textarea.value.length).toBe(240);
      expect(screen.getByText('0/240 caracteres')).toBeDefined();
      expect(screen.getByText(/Limite máximo de 240 caracteres atingido/i)).toBeDefined();
    });

    it('deve disparar onConfirmar com a observação preenchida ao clicar em Confirmar Item', () => {
      const onConfirmar = vi.fn();
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Filé Mignon"
          onConfirmar={onConfirmar}
          onClose={vi.fn()}
        />
      );

      const btnAoPonto = screen.getByRole('button', { name: 'Ao ponto' });
      fireEvent.click(btnAoPonto);

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Item/i });
      fireEvent.click(btnConfirmar);

      expect(onConfirmar).toHaveBeenCalledWith('Ao ponto');
    });

    it('deve disparar onClose ao clicar em Cancelar / Voltar ou no botão X', () => {
      const onClose = vi.fn();
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Suco Natural"
          onConfirmar={vi.fn()}
          onClose={onClose}
        />
      );

      const btnCancelar = screen.getAllByRole('button', { name: /Cancelar \/ Voltar/i })[0];
      fireEvent.click(btnCancelar);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('deve ativar o switch de alergia e incluir Alérgico nas observações', () => {
      render(
        <BottomSheetObservacao
          isOpen={true}
          produtoNome="Sobremesa"
          onConfirmar={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const switchAlergia = screen.getByText('Restrição / Alergia Alimentar');
      fireEvent.click(switchAlergia);

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(/Ex.: Sem cebola, carne ao ponto/i);
      expect(textarea.value).toContain('Alérgico');
    });
  });

  describe('2. ProdutoStepperCard com Botão de Observação', () => {
    const produtoMock: Produto = {
      id: 10,
      nome: 'Burger da Casa',
      categoria: 'lanches',
      preco: '35.00',
      estoque: 15,
      estoque_minimo: 2,
      ativo: true,
      criado_em: '2026-11-05T20:00:00Z',
      atualizado_em: '2026-11-05T20:00:00Z',
    };

    it('deve renderizar botão de adicionar observação com ícone de lápis e área de toque >= 44x44px', () => {
      const onAbrirObs = vi.fn();
      render(
        <ProdutoStepperCard
          produto={produtoMock}
          quantidade={0}
          onIncrementar={vi.fn()}
          onDecrementar={vi.fn()}
          onAbrirObservacao={onAbrirObs}
        />
      );

      const btnObs = screen.getByRole('button', { name: 'Adicionar observação' });
      expect(btnObs).toBeDefined();
      expect(btnObs.className).toContain('min-w-[44px]');
      expect(btnObs.className).toContain('min-h-[44px]');

      fireEvent.click(btnObs);
      expect(onAbrirObs).toHaveBeenCalledTimes(1);
    });

    it('deve exibir preview da observação em itálico e alterar label para Editar observação se houver observação', () => {
      render(
        <ProdutoStepperCard
          produto={produtoMock}
          quantidade={1}
          observacao="Sem cebola, bem passado"
          onIncrementar={vi.fn()}
          onDecrementar={vi.fn()}
          onAbrirObservacao={vi.fn()}
        />
      );

      expect(screen.getByText('Sem cebola, bem passado')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Editar observação' })).toBeDefined();
    });
  });

  describe('3. Integração de Serviço e Hook (comandasApi e useAdicionarItemComanda)', () => {
    it('adicionarItemComanda deve enviar { produto_id, quantidade, observacao } no POST /comandas/:id/itens', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 101,
        comanda_id: 1,
        produto_id: 10,
        nome_copiado: 'Burger da Casa',
        preco_copiado: '35.00',
        quantidade: 2,
        observacao: 'Ao ponto',
      });

      await adicionarItemComanda(1, {
        produto_id: 10,
        quantidade: 2,
        observacao: 'Ao ponto',
      });

      expect(postSpy).toHaveBeenCalledWith('/comandas/1/itens', {
        produto_id: 10,
        quantidade: 2,
        observacao: 'Ao ponto',
      });

      await comandasApi.adicionarItemComanda(1, {
        produto_id: 10,
        quantidade: 1,
        observacao: 'Sem maionese',
      });

      expect(postSpy).toHaveBeenCalledWith('/comandas/1/itens', {
        produto_id: 10,
        quantidade: 1,
        observacao: 'Sem maionese',
      });
    });
  });

  describe('4. ComandaMesaView: Fluxo Completo de Adição com Observação e Exibição (G03, G04, G05)', () => {
    const comandaMock: Comanda = {
      id: 5,
      mesa: 12,
      nome_cliente: 'Mesa 12',
      garcom_id: 1,
      status: 'aberta',
      subtotal: '35.00',
      taxa_servico: null,
      total: '35.00',
      forma_pagamento: null,
      aberta_em: '2026-11-05T20:00:00Z',
      fechada_em: null,
      paga_em: null,
      itens: [
        {
          id: 501,
          comanda_id: 5,
          produto_id: 10,
          nome_copiado: 'X-Salada Especial',
          preco_copiado: '35.00',
          quantidade: 1,
          observacao: 'Sem tomate, alérgico',
        },
      ],
    };

    const produtosMock: Produto[] = [
      {
        id: 10,
        nome: 'X-Salada Especial',
        categoria: 'lanches',
        preco: '35.00',
        estoque: 10,
        estoque_minimo: 2,
        ativo: true,
        criado_em: '2026-11-05T20:00:00Z',
        atualizado_em: '2026-11-05T20:00:00Z',
      },
    ];

    it('deve abrir Bottom Sheet G04 ao clicar no botão de observação do produto no cardápio', async () => {
      vi.spyOn(comandasApi, 'consultarPorId').mockResolvedValue(comandaMock);
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(produtosMock);

      renderWithQueryClient(
        <ComandaMesaView
          comandaId={5}
          garcomNome="Carlos"
          onVoltar={vi.fn()}
          onToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa 12')).toBeDefined();
      });

      // Localiza o botão de observação no cardápio (G03)
      const btnObs = await screen.findByRole('button', { name: 'Adicionar observação' });
      fireEvent.click(btnObs);

      // BottomSheetObservacao (G04) abre
      expect(await screen.findByText('G04 · Observação e Alergia')).toBeDefined();
      expect(screen.getByText('Personalizar: X-Salada Especial')).toBeDefined();
    });

    it('deve confirmar observação na Bottom Sheet, atualizar carrinho e enviar com observacao na API ao tocar em Enviar ao preparo (EARS-OBS-05)', async () => {
      vi.spyOn(comandasApi, 'consultarPorId').mockResolvedValue(comandaMock);
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(produtosMock);
      const postItemSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        id: 502,
        comanda_id: 5,
        produto_id: 10,
        nome_copiado: 'X-Salada Especial',
        preco_copiado: '35.00',
        quantidade: 1,
        observacao: 'Ao ponto, Sem cebola',
      });

      const onToast = vi.fn();
      renderWithQueryClient(
        <ComandaMesaView
          comandaId={5}
          garcomNome="Carlos"
          onVoltar={vi.fn()}
          onToast={onToast}
        />
      );

      // Abre bottom sheet
      const btnObs = await screen.findByRole('button', { name: 'Adicionar observação' });
      fireEvent.click(btnObs);

      // Clica em chips rápidos
      const btnAoPonto = await screen.findByRole('button', { name: 'Ao ponto' });
      fireEvent.click(btnAoPonto);
      const btnSemCebola = screen.getByRole('button', { name: 'Sem cebola' });
      fireEvent.click(btnSemCebola);

      // Confirma na bottom sheet
      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Item/i });
      fireEvent.click(btnConfirmar);

      // Barra inferior exibe "1 item novo" e botão "Enviar ao preparo"
      const btnEnviar = await screen.findByRole('button', { name: /Enviar ao preparo/i });
      fireEvent.click(btnEnviar);

      await waitFor(() => {
        expect(postItemSpy).toHaveBeenCalledWith(
          '/comandas/5/itens',
          expect.objectContaining({
            produto_id: 10,
            quantidade: 1,
            observacao: 'Ao ponto, Sem cebola',
          })
        );
      });
    });

    it('deve exibir a observação cadastrada na listagem de itens da comanda (EARS-OBS-08)', async () => {
      vi.spyOn(comandasApi, 'consultarPorId').mockResolvedValue(comandaMock);
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(produtosMock);

      renderWithQueryClient(
        <ComandaMesaView
          comandaId={5}
          garcomNome="Carlos"
          onVoltar={vi.fn()}
          onToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mesa 12')).toBeDefined();
      });

      // Alterna para sub-aba "Enviados"
      const btnEnviados = screen.getByRole('button', { name: /Enviados \(1\)/i });
      fireEvent.click(btnEnviados);

      // Verifica exibição do item com observação em estilo itálico
      const obsElement = await screen.findByText('Sem tomate, alérgico');
      expect(obsElement).toBeDefined();
      expect(obsElement.parentElement?.className).toContain('italic');
    });

    it('deve exibir a observação também na tela de Conta Pedida (isContaPedida)', async () => {
      const comandaFechada: Comanda = {
        ...comandaMock,
        status: 'fechada',
      };
      vi.spyOn(comandasApi, 'consultarPorId').mockResolvedValue(comandaFechada);
      vi.spyOn(produtosApi, 'listar').mockResolvedValue(produtosMock);

      renderWithQueryClient(
        <ComandaMesaView
          comandaId={5}
          garcomNome="Carlos"
          onVoltar={vi.fn()}
          onToast={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Conta pedida')).toBeDefined();
      });

      expect(screen.getByText('Sem tomate, alérgico')).toBeDefined();
    });
  });
});
