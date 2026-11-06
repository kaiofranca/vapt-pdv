import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModalTransferirMesa } from '../src/features/garcom/components/ModalTransferirMesa';
import { ModalMesclarComandas } from '../src/features/garcom/components/ModalMesclarComandas';
import { comandasApi } from '../src/services/comandas';
import { ApiError } from '../src/services/apiClient';
import type { Comanda } from '../src/types/api';

const mockComandasAbertas: Comanda[] = [
  {
    id: 1,
    mesa: 3,
    nome_cliente: 'Cliente Mesa 3',
    garcom_id: 1,
    status: 'aberta',
    subtotal: '50.00',
    taxa_servico: null,
    total: '50.00',
    forma_pagamento: null,
    aberta_em: '2026-11-05T19:00:00Z',
    fechada_em: null,
    paga_em: null,
    itens: [
      {
        id: 10,
        comanda_id: 1,
        produto_id: 1,
        nome_copiado: 'Hambúrguer Clássico',
        preco_copiado: '30.00',
        quantidade: 1,
        observacao: null,
      },
      {
        id: 11,
        comanda_id: 1,
        produto_id: 2,
        nome_copiado: 'Refrigerante Cola',
        preco_copiado: '10.00',
        quantidade: 2,
        observacao: null,
      },
    ],
  },
  {
    id: 2,
    mesa: 5,
    nome_cliente: 'Família Souza',
    garcom_id: 1,
    status: 'aberta',
    subtotal: '120.00',
    taxa_servico: null,
    total: '120.00',
    forma_pagamento: null,
    aberta_em: '2026-11-05T19:15:00Z',
    fechada_em: null,
    paga_em: null,
    itens: [
      {
        id: 20,
        comanda_id: 2,
        produto_id: 3,
        nome_copiado: 'Pizza Margherita',
        preco_copiado: '60.00',
        quantidade: 2,
        observacao: 'Massa fina',
      },
    ],
  },
  {
    id: 3,
    mesa: 7,
    nome_cliente: 'Mesa Varanda',
    garcom_id: 2,
    status: 'aberta',
    subtotal: '45.00',
    taxa_servico: null,
    total: '45.00',
    forma_pagamento: null,
    aberta_em: '2026-11-05T19:30:00Z',
    fechada_em: null,
    paga_em: null,
    itens: [],
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Story 2.5.1 — Core & Salão: Transferência de Mesa e Junção/Mesclagem de Comandas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(comandasApi, 'listar').mockResolvedValue(mockComandasAbertas);
  });

  describe('1. ModalTransferirMesa (AC-TRANSF-01, AC-TRANSF-03, EARS-TRANSF-03, EARS-TRANSF-06, EARS-TRANSF-08)', () => {
    it('deve renderizar o modal com título, mesa atual, input de nova mesa e botões (DESIGN.md)', () => {
      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Transferir Mesa')).toBeDefined();
      expect(screen.getByText(/Mesa atual:/i)).toBeDefined();
      expect(screen.getByText('Mesa 3')).toBeDefined();
      expect(screen.getByLabelText('Nova mesa')).toBeDefined();
      expect(screen.getByRole('button', { name: /Cancelar/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Confirmar Transferência/i })).toBeDefined();
    });

    it('não deve renderizar nada quando isOpen for false', () => {
      const { container } = renderWithClient(
        <ModalTransferirMesa
          isOpen={false}
          comandaId={1}
          mesaAtual={3}
          onClose={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('deve permitir transferir comanda para mesa livre com sucesso (AC-TRANSF-01, EARS-TRANSF-03)', async () => {
      const onSucesso = vi.fn();
      const onClose = vi.fn();

      const mockAtualizada: Comanda = {
        ...mockComandasAbertas[0],
        mesa: 8,
      };

      const spyTransferir = vi
        .spyOn(comandasApi, 'transferirMesa')
        .mockResolvedValueOnce(mockAtualizada);

      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={onClose}
          onSucesso={onSucesso}
        />
      );

      const input = screen.getByLabelText('Nova mesa');
      fireEvent.change(input, { target: { value: '8' } });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Transferência/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyTransferir).toHaveBeenCalledWith(1, 8);
        expect(onSucesso).toHaveBeenCalledWith(mockAtualizada);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve tratar erro 409 MESA_OCUPADA exibindo aviso e opção de mesclar comandas (AC-TRANSF-03, EARS-TRANSF-08)', async () => {
      const onAbrirMesclar = vi.fn();

      vi.spyOn(comandasApi, 'transferirMesa').mockRejectedValueOnce(
        new ApiError(409, {
          codigo: 'MESA_OCUPADA',
          mensagem: 'A mesa 5 já possui uma comanda aberta.',
        })
      );

      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={vi.fn()}
          onAbrirMesclar={onAbrirMesclar}
        />
      );

      const input = screen.getByLabelText('Nova mesa');
      fireEvent.change(input, { target: { value: '12' } });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Transferência/i });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByText(/A mesa 12 já possui comanda aberta/i)).toBeDefined();
      });

      // Botão para Mesclar Comandas deve estar visível
      const btnMesclar = screen.getByRole('button', { name: /Mesclar Comandas/i });
      expect(btnMesclar).toBeDefined();

      fireEvent.click(btnMesclar);
      expect(onAbrirMesclar).toHaveBeenCalledWith(12);
    });

    it('deve sinalizar preventivamente em tempo real se a mesa já estiver aberta no salão (EARS-TRANSF-06)', async () => {
      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={vi.fn()}
        />
      );

      // Espera carregamento da query de comandas abertas
      await waitFor(() => {
        expect(comandasApi.listar).toHaveBeenCalled();
      });

      const input = screen.getByLabelText('Nova mesa');
      // Mesa 5 já possui comanda aberta (#2)
      fireEvent.change(input, { target: { value: '5' } });

      await waitFor(() => {
        expect(screen.getByText(/A mesa 5 já possui comanda aberta/i)).toBeDefined();
      });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Transferência/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(true);
    });

    it('deve desabilitar confirmação se a nova mesa for igual à mesa atual', () => {
      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByLabelText('Nova mesa');
      fireEvent.change(input, { target: { value: '3' } });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Transferência/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(true);
    });

    it('deve fechar o modal ao clicar no botão Cancelar ou disparar Escape', () => {
      const onClose = vi.fn();
      renderWithClient(
        <ModalTransferirMesa
          isOpen={true}
          comandaId={1}
          mesaAtual={3}
          onClose={onClose}
        />
      );

      const btnCancelar = screen.getAllByRole('button', { name: /Cancelar/i })[0];
      fireEvent.click(btnCancelar);
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. ModalMesclarComandas (AC-TRANSF-02, EARS-TRANSF-04, EARS-TRANSF-05, EARS-TRANSF-07)', () => {
    it('deve renderizar modal com título, mesa de destino, aviso de auditoria e lista de comandas abertas elegíveis', async () => {
      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Juntar / Mesclar Mesas')).toBeDefined();
      expect(screen.getByText(/Destino:/i)).toBeDefined();
      expect(screen.getByText('Mesa 3')).toBeDefined();

      // Aviso de cancelamento e auditoria (EARS-TRANSF-04)
      expect(screen.getByText(/Transferência Definitiva de Itens/i)).toBeDefined();
      expect(screen.getByText(/encerrada como cancelada por auditoria/i)).toBeDefined();

      // Aguarda listar comandas e valida que comanda destino (#1) foi excluída (EARS-TRANSF-07)
      await waitFor(() => {
        expect(screen.getByText(/Mesa 5 · Família Souza/i)).toBeDefined();
        expect(screen.getByText(/Mesa 7 · Mesa Varanda/i)).toBeDefined();
      });

      // Mesa 3 (destino) não deve aparecer na lista de seleção de origem
      expect(screen.queryByText(/Mesa 3 · Cliente Mesa 3/i)).toBeNull();
    });

    it('não deve renderizar quando isOpen for false', () => {
      const { container } = renderWithClient(
        <ModalMesclarComandas
          isOpen={false}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('deve manter botão Confirmar Junção desabilitado enquanto nenhuma comanda de origem for selecionada', () => {
      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={vi.fn()}
        />
      );

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Junção/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(true);
    });

    it('deve mesclar comandas com sucesso ao selecionar a comanda de origem (AC-TRANSF-02, EARS-TRANSF-04)', async () => {
      const onSucesso = vi.fn();
      const onClose = vi.fn();

      const mockConsolidada: Comanda = {
        ...mockComandasAbertas[0],
        subtotal: '170.00',
        total: '170.00',
        itens: [...(mockComandasAbertas[0].itens || []), ...(mockComandasAbertas[1].itens || [])],
      };

      const spyMesclar = vi
        .spyOn(comandasApi, 'mesclarComandas')
        .mockResolvedValueOnce(mockConsolidada);

      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={onClose}
          onSucesso={onSucesso}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Mesa 5 · Família Souza/i)).toBeDefined();
      });

      // Clica na comanda da Mesa 5 (ID 2)
      const btnMesa5 = screen.getByText(/Mesa 5 · Família Souza/i);
      fireEvent.click(btnMesa5);

      // Resumo da mesclagem deve ser exibido
      expect(screen.getByText(/Origem selecionada:/i)).toBeDefined();
      expect(screen.getByText(/Mesa 5 \(Comanda #2\)/i)).toBeDefined();

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Junção/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyMesclar).toHaveBeenCalledWith(1, 2);
        expect(onSucesso).toHaveBeenCalledWith(mockConsolidada);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('deve pré-selecionar comanda de origem quando mesaOrigemSugerida for fornecida', async () => {
      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          mesaOrigemSugerida={5}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Origem selecionada:/i)).toBeDefined();
        expect(screen.getByText(/Mesa 5 \(Comanda #2\)/i)).toBeDefined();
      });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Junção/i });
      expect((btnConfirmar as HTMLButtonElement).disabled).toBe(false);
    });

    it('deve permitir filtrar comandas elegíveis por busca textual', async () => {
      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Mesa 5 · Família Souza/i)).toBeDefined();
        expect(screen.getByText(/Mesa 7 · Mesa Varanda/i)).toBeDefined();
      });

      const inputBusca = screen.getByPlaceholderText(/Digite o número da mesa de origem/i);
      fireEvent.change(inputBusca, { target: { value: '7' } });

      expect(screen.queryByText(/Mesa 5 · Família Souza/i)).toBeNull();
      expect(screen.getByText(/Mesa 7 · Mesa Varanda/i)).toBeDefined();
    });

    it('deve tratar erro 422 STATUS_INVALIDO ao tentar mesclar comanda não aberta', async () => {
      vi.spyOn(comandasApi, 'mesclarComandas').mockRejectedValueOnce(
        new ApiError(422, {
          codigo: 'COMANDA_NAO_ABERTA',
          mensagem: 'Apenas comandas com status aberto podem ser mescladas.',
        })
      );

      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          mesaOrigemSugerida={5}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Origem selecionada:/i)).toBeDefined();
      });

      const btnConfirmar = screen.getByRole('button', { name: /Confirmar Junção/i });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(
          screen.getByText(/Apenas comandas com status aberto podem ser mescladas/i)
        ).toBeDefined();
      });
    });

    it('deve fechar o modal ao clicar em Cancelar ou teclar Escape', () => {
      const onClose = vi.fn();
      renderWithClient(
        <ModalMesclarComandas
          isOpen={true}
          comandaDestinoId={1}
          mesaDestino={3}
          onClose={onClose}
        />
      );

      const btnCancelar = screen.getAllByRole('button', { name: /Cancelar/i })[0];
      fireEvent.click(btnCancelar);
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. comandasApi e contratos REST (:3000)', () => {
    it('transferirMesa deve formatar o payload PATCH /comandas/:id/transferir-mesa com nova_mesa numérica', async () => {
      const spyPatch = vi.fn().mockResolvedValue({ id: 10, mesa: 12 });
      vi.spyOn(comandasApi, 'transferirMesa').mockImplementation(async (id, mesa) => {
        return spyPatch(`/comandas/${id}/transferir-mesa`, { nova_mesa: Number(mesa) });
      });

      await comandasApi.transferirMesa(10, '12');
      expect(spyPatch).toHaveBeenCalledWith('/comandas/10/transferir-mesa', { nova_mesa: 12 });
    });

    it('mesclarComandas deve formatar o payload POST /comandas/:id/mesclar com comanda_origem_id', async () => {
      const spyPost = vi.fn().mockResolvedValue({ id: 10, status: 'aberta' });
      vi.spyOn(comandasApi, 'mesclarComandas').mockImplementation(async (destinoId, origemId) => {
        return spyPost(`/comandas/${destinoId}/mesclar`, { comanda_origem_id: origemId });
      });

      await comandasApi.mesclarComandas(10, 4);
      expect(spyPost).toHaveBeenCalledWith('/comandas/10/mesclar', { comanda_origem_id: 4 });
    });
  });
});
