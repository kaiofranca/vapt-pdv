import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SideNavGestao } from '../src/features/gestao/components/SideNavGestao';
import { ModalExportacao } from '../src/features/gestao/components/ModalExportacao';
import { ModoGestaoPage } from '../src/features/gestao/ModoGestaoPage';
import {
  obterResumoDiario,
  obterRankingProdutos,
  obterDesempenhoGarcons,
  obterAlertasEstoque,
  exportarRelatorio,
} from '../src/services/gestao';
import * as apiClient from '../src/services/apiClient';
import type {
  ResumoDiarioGestao,
  RankingProdutosResposta,
  DesempenhoGarconsResposta,
  AlertasEstoqueResposta,
} from '../src/types/api';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('Story 16/16.1/16.2 — Frontend Gestão Executiva & BI (TEA Quality Gate)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Testes de Contratos de Rotas e Tipos (services/gestao.ts)
  // ─────────────────────────────────────────────────────────────
  describe('1. Contratos de Rotas e Tipagem (API Client /gestao)', () => {
    it('obterResumoDiario deve invocar /gestao/resumo-diario com parâmetro de data', async () => {
      const mockResumo: ResumoDiarioGestao = {
        data: '2026-11-05',
        total_vendas: '1250.00',
        total_subtotal: '1136.36',
        total_taxa_servico: '113.64',
        quantidade_pedidos: 12,
        ticket_medio: '104.17',
        por_forma_pagamento: {
          pix: '600.00',
          cartao: '450.00',
          dinheiro: '200.00',
        },
      };

      const requestSpy = vi
        .spyOn(apiClient, 'request')
        .mockResolvedValueOnce(mockResumo);

      const res = await obterResumoDiario({ data: '2026-11-05' });

      expect(requestSpy).toHaveBeenCalledWith('/gestao/resumo-diario', {
        params: { data: '2026-11-05' },
      });
      expect(res.total_vendas).toBe('1250.00');
      expect(res.quantidade_pedidos).toBe(12);
      expect(res.por_forma_pagamento.pix).toBe('600.00');
    });

    it('obterRankingProdutos deve invocar /gestao/ranking-produtos com filtros de limite e categoria', async () => {
      const mockRanking: RankingProdutosResposta = {
        receita_total_acumulada: '3500.00',
        produtos: [
          {
            posicao: 1,
            produto_id: 10,
            nome_produto: 'Hambúrguer Gourmet',
            categoria: 'Lanches',
            quantidade_vendida: 50,
            receita_gerada: '2000.00',
            percentual_receita: '57.14',
            percentual_acumulado: '57.14',
            classe_abc: 'A',
          },
        ],
      };

      const requestSpy = vi
        .spyOn(apiClient, 'request')
        .mockResolvedValueOnce(mockRanking);

      const res = await obterRankingProdutos({ limite: 10, categoria: 'Lanches' });

      expect(requestSpy).toHaveBeenCalledWith('/gestao/ranking-produtos', {
        params: { limite: 10, categoria: 'Lanches' },
      });
      expect(res.produtos[0].classe_abc).toBe('A');
      expect(res.receita_total_acumulada).toBe('3500.00');
    });

    it('obterDesempenhoGarcons deve invocar /gestao/desempenho-garcons com comissões de 10%', async () => {
      const mockGarcons: DesempenhoGarconsResposta = {
        garcons: [
          {
            garcom_id: 1,
            garcom_nome: 'Lucas Silva',
            comandas_atendidas: 18,
            total_vendido: '1800.00',
            comissao_gerada: '180.00',
            ticket_medio: '100.00',
          },
        ],
      };

      const requestSpy = vi
        .spyOn(apiClient, 'request')
        .mockResolvedValueOnce(mockGarcons);

      const res = await obterDesempenhoGarcons();

      expect(requestSpy).toHaveBeenCalledWith('/gestao/desempenho-garcons');
      expect(res.garcons.length).toBe(1);
      expect(res.garcons[0].comissao_gerada).toBe('180.00');
    });

    it('obterAlertasEstoque deve repassar query param apenas_ativos', async () => {
      const mockAlertas: AlertasEstoqueResposta = {
        alertas: [
          {
            produto_id: 5,
            nome_produto: 'Cerveja Artesanal IPA',
            categoria: 'Bebidas',
            estoque_atual: 2,
            estoque_minimo: 10,
            nivel: 'baixo',
            ultimo_movimento_em: '2026-11-05T10:00:00.000Z',
          },
        ],
      };

      const requestSpy = vi
        .spyOn(apiClient, 'request')
        .mockResolvedValueOnce(mockAlertas);

      const res = await obterAlertasEstoque({ apenas_ativos: true });

      expect(requestSpy).toHaveBeenCalledWith('/gestao/alertas-estoque', {
        params: { apenas_ativos: true },
      });
      expect(res.alertas[0].nivel).toBe('baixo');
    });

    it('exportarRelatorio deve enviar query params de exportação e extrair Content-Disposition', async () => {
      const blobMock = new Blob(['coluna1,coluna2\r\nvalor1,valor2'], {
        type: 'text/csv',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: async () => blobMock,
        headers: {
          get: (header: string) => {
            if (header.toLowerCase() === 'content-disposition') {
              return 'attachment; filename="relatorio-faturamento.csv"';
            }
            return null;
          },
        },
      } as unknown as Response);

      const resultado = await exportarRelatorio({
        tipo: 'faturamento',
        formato: 'csv',
        de: '2026-11-01',
        ate: '2026-11-05',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/gestao/exportar?tipo=faturamento&formato=csv&de=2026-11-01&ate=2026-11-05',
        {
          headers: {
            Accept: 'text/csv',
          },
        },
      );
      expect(resultado.filename).toBe('relatorio-faturamento.csv');
      expect(resultado.blob).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Acessibilidade (WCAG 2.2 AA) & Design System (docs/DESIGN.md)
  // ─────────────────────────────────────────────────────────────
  describe('2. Auditoria de Acessibilidade e Design System', () => {
    it('SideNavGestao deve possuir aria-labels descritivos em todas as abas e botões', () => {
      const onAbaChange = vi.fn();
      const onAbrirExportacao = vi.fn();

      render(
        <SideNavGestao
          abaAtiva="visao-geral"
          onAbaChange={onAbaChange}
          onAbrirExportacao={onAbrirExportacao}
          totalAlertasEstoque={3}
        />,
      );

      // 1. Aba Visão Geral com aria-current="page"
      const abaVisaoGeral = screen.getByRole('button', { name: /Visão Geral/i });
      expect(abaVisaoGeral.getAttribute('aria-current')).toBe('page');

      // 2. Demais abas com labels acessíveis
      const abaCurvaAbc = screen.getByRole('button', { name: /Curva ABC/i });
      const abaGarcons = screen.getByRole('button', { name: /Garçons/i });
      const abaEstoque = screen.getByRole('button', { name: /Estoque/i });

      expect(abaCurvaAbc).toBeDefined();
      expect(abaGarcons).toBeDefined();
      expect(abaEstoque).toBeDefined();

      // Badge de alerta de estoque deve exibir a contagem
      expect(within(abaEstoque).getByText('3')).toBeDefined();

      // 3. Botão de Exportar Relatórios com aria-label explícito
      const btnExportar = screen.getByRole('button', {
        name: /Exportar relatórios gerenciais em CSV ou JSON/i,
      });
      expect(btnExportar).toBeDefined();

      fireEvent.click(btnExportar);
      expect(onAbrirExportacao).toHaveBeenCalledTimes(1);

      // 4. Botão de Logout com aria-label explícito
      const btnLogout = screen.getByRole('button', { name: /Sair da sessão/i });
      expect(btnLogout).toBeDefined();
    });

    it('SideNavGestao deve garantir alvos de clique >= 44x44px em todos os controles interativos', () => {
      const { container } = render(
        <SideNavGestao
          abaAtiva="curva-abc"
          onAbaChange={vi.fn()}
          onAbrirExportacao={vi.fn()}
        />,
      );

      const botoes = container.querySelectorAll('button');
      expect(botoes.length).toBeGreaterThanOrEqual(5);

      botoes.forEach((btn) => {
        const className = btn.className;
        // Valida que possui classes de dimensão mínima de toque (min-h-[44px], h-11, p-2 min-h ou py-3)
        const temAlturaAdequada =
          className.includes('min-h-[44px]') ||
          className.includes('py-3') ||
          className.includes('h-11');
        expect(temAlturaAdequada).toBe(true);
      });
    });

    it('Interface de Gestão NÃO deve conter emojis (apenas ícones SVG lineares Lucide)', () => {
      const { container } = render(
        <SideNavGestao
          abaAtiva="visao-geral"
          onAbaChange={vi.fn()}
          onAbrirExportacao={vi.fn()}
        />,
      );

      // Regex para detecção de emojis Unicode
      const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2700-\u27BF]/;
      const textoCompleto = container.textContent || '';
      expect(emojiRegex.test(textoCompleto)).toBe(false);

      // Garantir que ícones são SVGs (Lucide)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('ModalExportacao deve ter botões de formato CSV e JSON acessíveis e com alvo >= 44x44px', () => {
      renderWithQueryClient(
        <ModalExportacao isOpen={true} onClose={vi.fn()} />,
      );

      const btnCsv = screen.getByRole('button', {
        name: /Exportar no formato CSV/i,
      });
      const btnJson = screen.getByRole('button', {
        name: /Exportar no formato JSON/i,
      });

      expect(btnCsv).toBeDefined();
      expect(btnJson).toBeDefined();

      expect(btnCsv.className).toContain('min-h-[44px]');
      expect(btnJson.className).toContain('min-h-[44px]');

      // Botão primário "Gerar e Baixar Arquivo" deve ser do Design System com tamanho >= 44px
      const btnConfirmar = screen.getByRole('button', {
        name: /Gerar e Baixar Arquivo/i,
      });
      expect(btnConfirmar).toBeDefined();
      expect(btnConfirmar.className).toContain('min-h-[44px]');
    });

    it('Valores numéricos e contábeis devem utilizar tipografia com números tabulares (tabular-nums)', () => {
      // Mock de dados para renderizar a página principal de gestão
      vi.spyOn(apiClient, 'request').mockImplementation(async (url: string) => {
        if (url === '/gestao/resumo-diario') {
          return {
            data: '2026-11-05',
            total_vendas: '5420.50',
            total_subtotal: '4927.73',
            total_taxa_servico: '492.77',
            quantidade_pedidos: 45,
            ticket_medio: '120.46',
            por_forma_pagamento: {
              pix: '2500.00',
              cartao: '2000.00',
              dinheiro: '920.50',
            },
          };
        }
        if (url === '/gestao/ranking-produtos') {
          return {
            receita_total_acumulada: '4927.73',
            produtos: [],
          };
        }
        if (url === '/gestao/alertas-estoque') {
          return { alertas: [] };
        }
        return {};
      });

      const { container } = renderWithQueryClient(<ModoGestaoPage />);

      // Verifica presença de classes tabular-nums ou font-mono no documento
      const elementosTabulares = container.querySelectorAll(
        '.tabular-nums, .font-mono',
      );
      expect(elementosTabulares.length).toBeGreaterThan(0);
    });
  });
});
