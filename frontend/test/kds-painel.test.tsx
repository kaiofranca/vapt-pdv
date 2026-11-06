import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModoKdsPage } from '../src/features/kds/ModoKdsPage';
import { FichaCard } from '../src/features/kds/components/FichaCard';
import { kdsApi } from '../src/features/kds/api/kdsApi';
import type { FichaKds, FilaKdsResposta } from '../src/features/kds/types';

const mockFichas: FichaKds[] = [
  {
    id: 101,
    item_comanda_id: 1,
    comanda_id: 10,
    mesa: 5,
    nome_produto: 'Frango a Passarinho',
    quantidade: 2,
    setor: 'cozinha',
    status: 'recebido',
    garcom_nome: 'Lucas',
    observacao: 'Sem pimenta / Alergico',
    recebido_em: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min atrás (normal)
  },
  {
    id: 102,
    item_comanda_id: 2,
    comanda_id: 10,
    mesa: 3,
    nome_produto: 'Batata Frita Rustica',
    quantidade: 1,
    setor: 'cozinha',
    status: 'em_preparo',
    garcom_nome: 'Ana',
    observacao: null,
    recebido_em: new Date(Date.now() - 11 * 60 * 1000).toISOString(), // 11 min atrás (atencao)
  },
  {
    id: 103,
    item_comanda_id: 3,
    comanda_id: 12,
    mesa: 8,
    nome_produto: 'Caipirinha Tradicional',
    quantidade: 1,
    setor: 'bar',
    status: 'recebido',
    garcom_nome: 'Lucas',
    observacao: 'Pouco acucar',
    recebido_em: new Date(Date.now() - 16 * 60 * 1000).toISOString(), // 16 min atrás (atrasado)
  },
];

const mockFilaResposta: FilaKdsResposta = {
  fichas: mockFichas,
  resumo: {
    recebido: 2,
    em_preparo: 1,
    pronto: 0,
    atrasadas: 1,
  },
};

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

describe('Story 2.1.7 — KDS Frontend: Painel TV da Cozinha e Gestão de Fichas (K01 a K04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('AC-KDSUI-01: deve renderizar os tickets de preparo com mesa, garçom, produto e cronômetro', async () => {
    vi.spyOn(kdsApi, 'listarFichas').mockResolvedValue(mockFilaResposta);

    renderWithClient(<ModoKdsPage />);

    const mesa5 = await screen.findByText('MESA 05');
    expect(mesa5).toBeDefined();
    expect(screen.getByText('MESA 03')).toBeDefined();
    expect(screen.getByText('MESA 08')).toBeDefined();

    expect(screen.getByText('Frango a Passarinho')).toBeDefined();
    expect(screen.getByText('2x')).toBeDefined();
    expect(screen.getByText('Batata Frita Rustica')).toBeDefined();
  });

  it('EARS-KDSUI-02: deve destacar visualmente observações e restrições alimentares no card', async () => {
    vi.spyOn(kdsApi, 'listarFichas').mockResolvedValue(mockFilaResposta);

    renderWithClient(<ModoKdsPage />);

    const obs = await screen.findByText(/Sem pimenta \/ Alergico/i);
    expect(obs).toBeDefined();
  });

  it('AC-KDSUI-03: deve identificar atraso crítico quando o tempo decorrido for superior a 15 minutos', async () => {
    vi.spyOn(kdsApi, 'listarFichas').mockResolvedValue(mockFilaResposta);

    renderWithClient(<ModoKdsPage />);

    const atrasos = await screen.findAllByText(/atrasado/i);
    expect(atrasos.length).toBeGreaterThanOrEqual(1);
  });

  it('AC-KDSUI-02: deve chamar PATCH /kds/fichas/:id/status ao acionar o botão de transição de estado', async () => {
    const onAtualizarStatus = vi.fn();

    // Ficha recebido -> Botão "INICIAR PREPARO"
    const { rerender } = render(
      <FichaCard ficha={mockFichas[0]} onAtualizarStatus={onAtualizarStatus} />
    );

    const btnIniciar = screen.getByRole('button', { name: /INICIAR PREPARO/i });
    fireEvent.click(btnIniciar);
    expect(onAtualizarStatus).toHaveBeenCalledWith(101, 'em_preparo');

    // Ficha em preparo -> Botão "MARCAR PRONTO"
    rerender(
      <FichaCard ficha={mockFichas[1]} onAtualizarStatus={onAtualizarStatus} />
    );
    const btnPronto = screen.getByRole('button', { name: /MARCAR PRONTO/i });
    fireEvent.click(btnPronto);
    expect(onAtualizarStatus).toHaveBeenCalledWith(102, 'pronto');

    // Ficha pronto -> Botão "ENTREGUE AO SALÃO"
    const fichaPronta: FichaKds = { ...mockFichas[0], id: 104, status: 'pronto' };
    rerender(
      <FichaCard ficha={fichaPronta} onAtualizarStatus={onAtualizarStatus} />
    );
    const btnEntregue = screen.getByRole('button', { name: /ENTREGUE AO SALÃO/i });
    fireEvent.click(btnEntregue);
    expect(onAtualizarStatus).toHaveBeenCalledWith(104, 'entregue');
  });

  it('AC-KDSUI-04 & EARS-KDSUI-11: deve exibir aviso discreto de reconexão se a API do KDS falhar', async () => {
    vi.spyOn(kdsApi, 'listarFichas').mockRejectedValue(new Error('KDS offline'));

    renderWithClient(<ModoKdsPage />);

    const aviso = await screen.findByText(/Reconectando à cozinha/i);
    expect(aviso).toBeDefined();
  });

  it('EARS-KDSUI-07: deve permitir filtrar os pedidos por estação (Todas / Cozinha / Bar)', async () => {
    const spy = vi.spyOn(kdsApi, 'listarFichas').mockResolvedValue(mockFilaResposta);

    renderWithClient(<ModoKdsPage />);

    await screen.findByText('MESA 05');

    // Clica no filtro "Bar"
    const btnBar = screen.getByRole('button', { name: /Bar/i });
    fireEvent.click(btnBar);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ estacao: 'bar' })
      );
    });
  });
});
