import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { obterPendenciasComanda, kdsApi } from '../src/services/kds';
import { ModalPendenciasKds, type ItemPendenciaModal } from '../src/features/caixa/components/ModalPendenciasKds';
import { PainelComanda } from '../src/features/caixa/components/PainelComanda';
import type { Comanda } from '../src/types/api';

const mockComandaAberta: Comanda = {
  id: 42,
  mesa: 7,
  garcom_id: 2,
  status: 'aberta',
  nome_cliente: 'Mariana Lima',
  aberta_em: '2026-11-05T19:30:00Z',
  fechada_em: null,
  paga_em: null,
  subtotal: '78.00',
  taxa_servico: null,
  total: null,
  forma_pagamento: null,
  itens: [
    {
      id: 101,
      comanda_id: 42,
      produto_id: 10,
      nome_copiado: 'Hambúrguer Artesanal',
      preco_copiado: '34.00',
      quantidade: 2,
      observacao: 'Sem cebola',
    },
    {
      id: 102,
      comanda_id: 42,
      produto_id: 20,
      nome_copiado: 'Suco Natural de Laranja',
      preco_copiado: '10.00',
      quantidade: 1,
      observacao: null,
    },
  ],
};

const mockPendencias: ItemPendenciaModal[] = [
  {
    id: 1,
    item_comanda_id: 101,
    produto_id: 10,
    nome_produto: 'Hambúrguer Artesanal',
    setor: 'cozinha',
    status: 'em_preparo',
    quantidade: 2,
    recebido_em: '2026-11-05T19:31:00Z',
  },
  {
    id: 2,
    item_comanda_id: 102,
    produto_id: 20,
    nome_produto: 'Suco Natural de Laranja',
    setor: 'bar',
    status: 'recebido',
    quantidade: 1,
    recebido_em: '2026-11-05T19:32:00Z',
  },
];

function mockJsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Story 2.2.9 — Caixa & Salão: Checagem de Pendências do KDS no Fechamento (RF23, C04)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Serviço de Consulta ao KDS: obterPendenciasComanda', () => {
    it('deve retornar possui_pendencias: true e lista mapeada quando houver itens ativos', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          comanda_id: 42,
          mesa: 7,
          possui_pendencias: true,
          pendencias: mockPendencias,
        })
      );

      const resultado = await obterPendenciasComanda(42);

      expect(resultado.possui_pendencias).toBe(true);
      expect(resultado.offline).toBe(false);
      expect(resultado.pendencias).toHaveLength(2);
      expect(resultado.pendencias[0]).toMatchObject({
        nome_produto: 'Hambúrguer Artesanal',
        quantidade: 2,
        setor: 'cozinha',
        status: 'em_preparo',
      });
      expect(resultado.pendencias[1]).toMatchObject({
        nome_produto: 'Suco Natural de Laranja',
        quantidade: 1,
        setor: 'bar',
        status: 'recebido',
      });
    });

    it('deve interpretar payload padrão de itens do KDS filtrando itens entregues e cancelados', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          comanda_id: 42,
          mesa: 7,
          possui_pendencias: true,
          totais: { recebido: 1, em_preparo: 0, pronto: 0, entregue: 1, cancelado: 0 },
          itens: [
            {
              ficha_id: 11,
              item_comanda_id: 101,
              nome_produto: 'Batata Frita',
              estacao: 'cozinha',
              status: 'entregue',
              quantidade: 1,
            },
            {
              ficha_id: 12,
              item_comanda_id: 102,
              nome_produto: 'Cerveja Artesanal',
              estacao: 'bar',
              status: 'recebido',
              quantidade: 2,
            },
          ],
        })
      );

      const resultado = await kdsApi.obterPendenciasComanda(42);

      expect(resultado.possui_pendencias).toBe(true);
      expect(resultado.offline).toBe(false);
      expect(resultado.pendencias).toHaveLength(1);
      expect(resultado.pendencias[0].nome_produto).toBe('Cerveja Artesanal');
      expect(resultado.pendencias[0].setor).toBe('bar');
    });

    it('deve retornar possui_pendencias: false quando não houver itens pendentes no KDS', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          comanda_id: 42,
          mesa: 7,
          possui_pendencias: false,
          itens: [],
        })
      );

      const resultado = await obterPendenciasComanda(42);

      expect(resultado.possui_pendencias).toBe(false);
      expect(resultado.pendencias).toEqual([]);
      expect(resultado.offline).toBe(false);
    });

    it('deve aplicar degradação suave quando o KDS responder com erro HTTP 503', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' })
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resultado = await obterPendenciasComanda(42);

      expect(resultado.possui_pendencias).toBe(false);
      expect(resultado.pendencias).toEqual([]);
      expect(resultado.offline).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('deve aplicar degradação suave com timeout de 2000ms ou erro de conexão', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resultado = await obterPendenciasComanda(42);

      expect(resultado.possui_pendencias).toBe(false);
      expect(resultado.pendencias).toEqual([]);
      expect(resultado.offline).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('2. Modal C04 Conflito de Encerramento (ModalPendenciasKds)', () => {
    it('deve renderizar o diálogo C04 com alerta âmbar e lista detalhada de itens pendentes', () => {
      const onAguardar = vi.fn();
      const onFechar = vi.fn();

      render(
        <ModalPendenciasKds
          isOpen={true}
          mesa="07"
          pendencias={mockPendencias}
          onAguardarEntrega={onAguardar}
          onFecharMesmoAssim={onFechar}
        />
      );

      // Título e identificação do conflito C04
      expect(screen.getByText(/C04 Conflito de Encerramento/i)).toBeDefined();
      expect(screen.getByText(/Mesa 07 possui pedidos não entregues no KDS/i)).toBeDefined();

      // Lista detalhada de itens
      expect(screen.getAllByText('Hambúrguer Artesanal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('2x')).toBeDefined();
      expect(screen.getByText(/Setor: Cozinha/i)).toBeDefined();
      expect(screen.getByText('Em preparo')).toBeDefined();

      expect(screen.getByText('Suco Natural de Laranja')).toBeDefined();
      expect(screen.getByText('1x')).toBeDefined();
      expect(screen.getByText(/Setor: Bar/i)).toBeDefined();
      expect(screen.getByText('Recebido')).toBeDefined();

      // Checkbox de consentimento (EARS-PEND-08)
      expect(
        screen.getByText(/Estou ciente de que há itens em preparo e confirmo o encerramento/i)
      ).toBeDefined();

      // Botões de ação com alvos de toque adequados
      const btnAguardar = screen.getByRole('button', { name: /Aguardar Entrega/i });
      const btnFechar = screen.getByRole('button', { name: /Fechar Mesmo Assim/i });
      expect(btnAguardar).toBeDefined();
      expect(btnFechar).toBeDefined();
    });

    it('deve disparar onAguardarEntrega ao clicar em "Aguardar Entrega"', () => {
      const onAguardar = vi.fn();
      const onFechar = vi.fn();

      render(
        <ModalPendenciasKds
          isOpen={true}
          mesa={7}
          pendencias={mockPendencias}
          onAguardarEntrega={onAguardar}
          onFecharMesmoAssim={onFechar}
        />
      );

      const btnAguardar = screen.getByRole('button', { name: /Aguardar Entrega/i });
      fireEvent.click(btnAguardar);

      expect(onAguardar).toHaveBeenCalledTimes(1);
      expect(onFechar).not.toHaveBeenCalled();
    });

    it('deve disparar onFecharMesmoAssim ao clicar em "Fechar Mesmo Assim"', () => {
      const onAguardar = vi.fn();
      const onFechar = vi.fn();

      render(
        <ModalPendenciasKds
          isOpen={true}
          mesa={7}
          pendencias={mockPendencias}
          onAguardarEntrega={onAguardar}
          onFecharMesmoAssim={onFechar}
        />
      );

      const btnFechar = screen.getByRole('button', { name: /Fechar Mesmo Assim/i });
      fireEvent.click(btnFechar);

      expect(onFechar).toHaveBeenCalledTimes(1);
      expect(onAguardar).not.toHaveBeenCalled();
    });
  });

  describe('3. Integração do Fechamento no Caixa com Checagem KDS e Resiliência', () => {
    it('deve abrir o modal C04 ao tentar cobrar comanda aberta que possui pendências no KDS', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/kds/comandas/42/pendencias')) {
          return Promise.resolve(
            mockJsonResponse({
              comanda_id: 42,
              mesa: 7,
              possui_pendencias: true,
              pendencias: mockPendencias,
            })
          );
        }
        return Promise.resolve(mockJsonResponse(mockComandaAberta));
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const onToast = vi.fn();
      const onAbrirPagamento = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <PainelComanda
            comandaAtivaId={42}
            comandasDisponiveis={[mockComandaAberta]}
            onSelecionarComanda={vi.fn()}
            onAbrirModalPagamento={onAbrirPagamento}
            onAbrirModalCliente={vi.fn()}
            onCancelarComanda={vi.fn()}
            onToast={onToast}
            taxa10={true}
            onTaxa10Change={vi.fn()}
          />
        </QueryClientProvider>
      );

      const btnCobrar = screen.getByRole('button', { name: /Cobrar comanda/i });
      fireEvent.click(btnCobrar);

      // Deve abrir o diálogo C04
      await waitFor(() => {
        expect(screen.getByText(/C04 Conflito de Encerramento/i)).toBeDefined();
      });

      expect(screen.getAllByText('Hambúrguer Artesanal').length).toBeGreaterThanOrEqual(1);
      expect(onAbrirPagamento).not.toHaveBeenCalled();

      // Clicar em "Aguardar Entrega" aborta o encerramento e fecha o modal
      const btnAguardar = screen.getByRole('button', { name: /Aguardar Entrega/i });
      fireEvent.click(btnAguardar);

      await waitFor(() => {
        expect(screen.queryByText(/C04 Conflito de Encerramento/i)).toBeNull();
      });
      expect(onToast).toHaveBeenCalledWith(
        'info',
        expect.stringMatching(/Aguardando entrega dos pedidos da mesa/i)
      );
      expect(onAbrirPagamento).not.toHaveBeenCalled();
    });

    it('deve prosseguir com fechamento ao confirmar "Fechar Mesmo Assim"', async () => {
      const comandaFechadaResposta: Comanda = {
        ...mockComandaAberta,
        status: 'fechada',
        subtotal: '78.00',
        taxa_servico: '7.80',
        total: '85.80',
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/kds/comandas/42/pendencias')) {
          return Promise.resolve(
            mockJsonResponse({
              comanda_id: 42,
              mesa: 7,
              possui_pendencias: true,
              pendencias: mockPendencias,
            })
          );
        }
        if (url.includes('/comandas/42/fechar') && opts?.method === 'POST') {
          return Promise.resolve(mockJsonResponse(comandaFechadaResposta));
        }
        return Promise.resolve(mockJsonResponse(mockComandaAberta));
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const onToast = vi.fn();
      const onAbrirPagamento = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <PainelComanda
            comandaAtivaId={42}
            comandasDisponiveis={[mockComandaAberta]}
            onSelecionarComanda={vi.fn()}
            onAbrirModalPagamento={onAbrirPagamento}
            onAbrirModalCliente={vi.fn()}
            onCancelarComanda={vi.fn()}
            onToast={onToast}
            taxa10={true}
            onTaxa10Change={vi.fn()}
          />
        </QueryClientProvider>
      );

      const btnCobrar = screen.getByRole('button', { name: /Cobrar comanda/i });
      fireEvent.click(btnCobrar);

      await waitFor(() => {
        expect(screen.getByText(/C04 Conflito de Encerramento/i)).toBeDefined();
      });

      const btnFecharMesmoAssim = screen.getByRole('button', { name: /Fechar Mesmo Assim/i });
      fireEvent.click(btnFecharMesmoAssim);

      await waitFor(() => {
        expect(screen.queryByText(/C04 Conflito de Encerramento/i)).toBeNull();
        expect(onAbrirPagamento).toHaveBeenCalledWith(expect.objectContaining({ status: 'fechada' }));
      });
    });

    it('deve aplicar degradação graciosa quando KDS estiver offline ou em timeout, permitindo fechamento direto com aviso', async () => {
      const comandaFechadaResposta: Comanda = {
        ...mockComandaAberta,
        status: 'fechada',
        subtotal: '78.00',
        taxa_servico: '7.80',
        total: '85.80',
      };

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/kds/comandas/42/pendencias')) {
          // Simula falha de conexão (KDS offline)
          return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:3001'));
        }
        if (url.includes('/comandas/42/fechar') && opts?.method === 'POST') {
          return Promise.resolve(mockJsonResponse(comandaFechadaResposta));
        }
        return Promise.resolve(mockJsonResponse(mockComandaAberta));
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const onToast = vi.fn();
      const onAbrirPagamento = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <PainelComanda
            comandaAtivaId={42}
            comandasDisponiveis={[mockComandaAberta]}
            onSelecionarComanda={vi.fn()}
            onAbrirModalPagamento={onAbrirPagamento}
            onAbrirModalCliente={vi.fn()}
            onCancelarComanda={vi.fn()}
            onToast={onToast}
            taxa10={true}
            onTaxa10Change={vi.fn()}
          />
        </QueryClientProvider>
      );

      const btnCobrar = screen.getByRole('button', { name: /Cobrar comanda/i });
      fireEvent.click(btnCobrar);

      // Não deve travar a tela: deve emitir aviso do KDS e prosseguir com fechamento
      await waitFor(() => {
        expect(onToast).toHaveBeenCalledWith(
          'info',
          expect.stringMatching(/KDS indisponível/i)
        );
        expect(onAbrirPagamento).toHaveBeenCalledWith(expect.objectContaining({ status: 'fechada' }));
      });

      expect(screen.queryByText(/C04 Conflito de Encerramento/i)).toBeNull();
    });
  });
});
