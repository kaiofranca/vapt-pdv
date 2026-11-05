import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CurvaAbcView,
  DesempenhoGarconsView,
  AlertasEstoqueView,
  ModalExportacao,
} from '../src/features/gestao/analiticos';
import * as gestaoApi from '../src/services/gestao';
import type {
  RankingProdutosResposta,
  DesempenhoGarconsResposta,
  AlertasEstoqueResposta,
} from '../src/types/api';

const mockRankingProdutos: RankingProdutosResposta = {
  receita_total_acumulada: '4520.00',
  produtos: [
    {
      posicao: 1,
      produto_id: 1,
      nome_produto: 'Hambúrguer Artesanal Vapt',
      categoria: 'Lanches',
      quantidade_vendida: 60,
      receita_gerada: '2100.00',
      percentual_receita: '46.46',
      percentual_acumulado: '46.46',
      classe_abc: 'A',
    },
    {
      posicao: 2,
      produto_id: 2,
      nome_produto: 'Cerveja Artesanal IPA',
      categoria: 'Bebidas',
      quantidade_vendida: 80,
      receita_gerada: '1440.00',
      percentual_receita: '31.86',
      percentual_acumulado: '78.32',
      classe_abc: 'A',
    },
    {
      posicao: 3,
      produto_id: 3,
      nome_produto: 'Batata Rústica com Alecrim',
      categoria: 'Porções',
      quantidade_vendida: 30,
      receita_gerada: '660.00',
      percentual_receita: '14.60',
      percentual_acumulado: '92.92',
      classe_abc: 'B',
    },
    {
      posicao: 4,
      produto_id: 4,
      nome_produto: 'Pudim de Leite Condensado',
      categoria: 'Sobremesas',
      quantidade_vendida: 16,
      receita_gerada: '320.00',
      percentual_receita: '7.08',
      percentual_acumulado: '100.00',
      classe_abc: 'C',
    },
  ],
};

const mockDesempenhoGarcons: DesempenhoGarconsResposta = {
  garcons: [
    {
      garcom_id: 1,
      garcom_nome: 'Carlos Garçom',
      comandas_atendidas: 28,
      total_vendido: '2980.00',
      comissao_gerada: '298.00',
      ticket_medio: '106.43',
    },
    {
      garcom_id: 2,
      garcom_nome: 'Ana Atendente',
      comandas_atendidas: 20,
      total_vendido: '1992.00',
      comissao_gerada: '199.20',
      ticket_medio: '99.60',
    },
  ],
};

const mockAlertasEstoque: AlertasEstoqueResposta = {
  alertas: [
    {
      produto_id: 2,
      nome_produto: 'Cerveja Artesanal IPA',
      categoria: 'Bebidas',
      estoque_atual: 0,
      estoque_minimo: 20,
      nivel: 'zerado',
      ultimo_movimento_em: '2026-11-04T18:30:00.000Z',
    },
    {
      produto_id: 3,
      nome_produto: 'Batata Rústica com Alecrim',
      categoria: 'Porções',
      estoque_atual: 5,
      estoque_minimo: 15,
      nivel: 'baixo',
      ultimo_movimento_em: '2026-11-04T17:15:00.000Z',
    },
  ],
};

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('Componentes Analíticos da Gestão & BI (Story 16.2 em analiticos/)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. CurvaAbcView (M10): deve renderizar os cards de Classe A, B, C e a tabela de produtos', async () => {
    vi.spyOn(gestaoApi, 'obterRankingProdutos').mockResolvedValue(mockRankingProdutos);

    renderWithQuery(<CurvaAbcView />);

    await waitFor(() => {
      expect(screen.getByText('Curva ABC de Produtos')).toBeDefined();
      expect(screen.getByText(/Classe A · Alto Impacto/i)).toBeDefined();
      expect(screen.getByText('Hambúrguer Artesanal Vapt')).toBeDefined();
      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.getByText('Batata Rústica com Alecrim')).toBeDefined();
      expect(screen.getByText('Pudim de Leite Condensado')).toBeDefined();
    });
  });

  it('2. DesempenhoGarconsView (M11): deve renderizar garçons em destaque e comissões', async () => {
    vi.spyOn(gestaoApi, 'obterDesempenhoGarcons').mockResolvedValue(mockDesempenhoGarcons);

    renderWithQuery(<DesempenhoGarconsView />);

    await waitFor(() => {
      expect(screen.getByText('Desempenho de Garçons')).toBeDefined();
      expect(screen.getByText(/Maior Faturamento/i)).toBeDefined();
      expect(screen.getAllByText('Carlos Garçom').length).toBeGreaterThan(0);
      expect(screen.getByText('Ana Atendente')).toBeDefined();
    });
  });

  it('3. AlertasEstoqueView (M05): deve exibir banner de alerta crítico e produtos com saldo', async () => {
    vi.spyOn(gestaoApi, 'obterAlertasEstoque').mockResolvedValue(mockAlertasEstoque);

    renderWithQuery(<AlertasEstoqueView />);

    await waitFor(() => {
      expect(screen.getByText('Alertas de Estoque')).toBeDefined();
      expect(screen.getByText(/2 itens requerem reposição/i)).toBeDefined();
      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.getByText('Batata Rústica com Alecrim')).toBeDefined();
      expect(screen.getByText('Esgotado')).toBeDefined();
      expect(screen.getByText('Estoque Baixo')).toBeDefined();
    });
  });

  it('4. ModalExportacao (M15): deve permitir selecionar relatório e disparar download', async () => {
    const handleClose = vi.fn();
    const exportarSpy = vi.spyOn(gestaoApi, 'exportarRelatorio').mockResolvedValue({
      blob: new Blob(['csv content'], { type: 'text/csv' }),
      filename: 'relatorio-faturamento.csv',
    });
    vi.spyOn(gestaoApi, 'acionarDownloadNavegador').mockImplementation(() => {});

    render(<ModalExportacao isOpen={true} onClose={handleClose} tipoInicial="faturamento" />);

    expect(screen.getByText('Exportar Dados Gerenciais')).toBeDefined();
    expect(screen.getByText('Faturamento Diário')).toBeDefined();
    expect(screen.getByText('Curva ABC de Produtos')).toBeDefined();

    const btnBaixar = screen.getByRole('button', { name: /Baixar Relatório/i });
    fireEvent.click(btnBaixar);

    await waitFor(() => {
      expect(exportarSpy).toHaveBeenCalledWith({
        tipo: 'faturamento',
        formato: 'csv',
        de: undefined,
        ate: undefined,
      });
    });
  });
});
