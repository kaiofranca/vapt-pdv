import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SideNavGestao } from '../src/features/gestao/components/SideNavGestao';
import { VisaoGeralView } from '../src/features/gestao/components/VisaoGeralView';
import { CurvaAbcView } from '../src/features/gestao/components/CurvaAbcView';
import { DesempenhoGarconsView } from '../src/features/gestao/components/DesempenhoGarconsView';
import { EstoqueAlertasView } from '../src/features/gestao/components/EstoqueAlertasView';
import { ModalExportacao } from '../src/features/gestao/components/ModalExportacao';
import { useSessionStore } from '../src/stores/useSessionStore';
import * as gestaoApi from '../src/services/gestao';
import type {
  ResumoDiarioGestao,
  RankingProdutosResposta,
  DesempenhoGarconsResposta,
  AlertasEstoqueResposta,
  Usuario,
} from '../src/types/api';

// Mocks de dados de Gestão & BI
const mockResumoDiario: ResumoDiarioGestao = {
  data: '2026-11-04',
  total_vendas: '4972.00',
  total_subtotal: '4520.00',
  total_taxa_servico: '452.00',
  quantidade_pedidos: 48,
  ticket_medio: '103.58',
  por_forma_pagamento: {
    pix: '2486.00',
    cartao: '1988.80',
    dinheiro: '497.20',
  },
};

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
      quantidade_vendida: 20,
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
      garcom_nome: 'Lucas Silva',
      comandas_atendidas: 22,
      total_vendido: '2400.00',
      comissao_gerada: '240.00',
      ticket_medio: '109.09',
    },
    {
      garcom_id: 2,
      garcom_nome: 'Ana Oliveira',
      comandas_atendidas: 16,
      total_vendido: '1650.00',
      comissao_gerada: '165.00',
      ticket_medio: '103.12',
    },
    {
      garcom_id: 3,
      garcom_nome: 'Rodrigo Costa',
      comandas_atendidas: 10,
      total_vendido: '922.00',
      comissao_gerada: '92.20',
      ticket_medio: '92.20',
    },
  ],
};

const mockAlertasEstoque: AlertasEstoqueResposta = {
  alertas: [
    {
      produto_id: 5,
      nome_produto: 'Refrigerante Cola Zero',
      categoria: 'Bebidas',
      estoque_atual: 0,
      estoque_minimo: 15,
      nivel: 'zerado',
      ultimo_movimento_em: '2026-11-04T18:30:00Z',
    },
    {
      produto_id: 6,
      nome_produto: 'Pão Brioche Especial',
      categoria: 'Insumos',
      estoque_atual: 4,
      estoque_minimo: 20,
      nivel: 'baixo',
      ultimo_movimento_em: '2026-11-04T19:00:00Z',
    },
  ],
};

function criarQueryClientTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderComQueryClient(ui: React.ReactElement) {
  const queryClient = criarQueryClientTeste();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('Estação Frontend do Modo Gestão & BI (Stories 16.1 e 16.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().logout();

    // Stub universal de fetch para a API do gestao-service (:3003)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/gestao/resumo-diario')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockResumoDiario,
            text: async () => JSON.stringify(mockResumoDiario),
          };
        }
        if (url.includes('/gestao/ranking-produtos')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockRankingProdutos,
            text: async () => JSON.stringify(mockRankingProdutos),
          };
        }
        if (url.includes('/gestao/desempenho-garcons')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockDesempenhoGarcons,
            text: async () => JSON.stringify(mockDesempenhoGarcons),
          };
        }
        if (url.includes('/gestao/alertas-estoque')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => mockAlertasEstoque,
            text: async () => JSON.stringify(mockAlertasEstoque),
          };
        }
        if (url.includes('/gestao/exportar')) {
          const isJson = url.includes('formato=json');
          return {
            ok: true,
            status: 200,
            headers: new Headers({
              'content-type': isJson ? 'application/json' : 'text/csv',
              'content-disposition': 'attachment; filename="relatorio-faturamento.csv"',
            }),
            blob: async () =>
              new Blob([isJson ? '[]' : 'col1,col2'], {
                type: isJson ? 'application/json' : 'text/csv',
              }),
            json: async () => [],
            text: async () => (isJson ? '[]' : 'col1,col2'),
          };
        }
        return {
          ok: false,
          status: 404,
          headers: new Headers(),
          json: async () => ({}),
          text: async () => 'Not found',
        };
      }),
    );
  });

  describe('1. Despacho e Autenticação de Perfil (useSessionStore)', () => {
    it('deve direcionar o perfil "gerente" diretamente para o modo "gestao"', () => {
      const usuarioGerente: Usuario = {
        id: 99,
        nome: 'Carlos Eduardo',
        perfil: 'gerente',
        ativo: true,
        criado_em: '2026-10-20T10:00:00Z',
        atualizado_em: '2026-10-20T10:00:00Z',
      };

      useSessionStore.getState().login(usuarioGerente);

      const state = useSessionStore.getState();
      expect(state.modo).toBe('gestao');
      expect(state.usuarioAtivoId).toBe(99);
      expect(state.nomeOperador).toBe('Carlos Eduardo');
      expect(state.perfilAtivo).toBe('gerente');
    });
  });

  describe('2. SideNavGestao (Shell Gerencial M01)', () => {
    it('deve renderizar o logotipo, abas oficiais e responder à alternância de abas', () => {
      const onAbaChange = vi.fn();
      const onAbrirExportacao = vi.fn();

      render(
        <SideNavGestao
          abaAtiva="visao-geral"
          onAbaChange={onAbaChange}
          onAbrirExportacao={onAbrirExportacao}
          totalAlertasEstoque={2}
        />,
      );

      // Logotipo e Identificação
      expect(screen.getByText(/Gestão Executiva & BI/i)).toBeDefined();

      // Abas oficiais
      expect(screen.getByText('Visão Geral')).toBeDefined();
      expect(screen.getByText('Curva ABC')).toBeDefined();
      expect(screen.getByText('Garçons')).toBeDefined();
      expect(screen.getByText('Estoque')).toBeDefined();

      // Badge de alerta de estoque crítico
      expect(screen.getByText('2')).toBeDefined();

      // Alternância de abas
      fireEvent.click(screen.getByText('Curva ABC'));
      expect(onAbaChange).toHaveBeenCalledWith('curva-abc');

      // Botão de Exportação
      fireEvent.click(screen.getByText(/Exportar Dados/i));
      expect(onAbrirExportacao).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. VisaoGeralView (Story 16.1 - M01 Dashboard Executivo)', () => {
    it('deve renderizar os 5 cards de KPI, gráfico com barras mostarda e preview da Curva ABC', async () => {
      const onNavegarAba = vi.fn();
      const onAbrirExportacao = vi.fn();

      renderComQueryClient(
        <VisaoGeralView
          onNavegarAba={onNavegarAba}
          onAbrirExportacao={onAbrirExportacao}
        />,
      );

      // Aguarda carregamento dos KPIs
      await waitFor(() => {
        expect(screen.getByText(/Visão Geral Executiva/i)).toBeDefined();
      });

      // Total Bruto Faturado formatado em R$ 4.972,00 (no card e no cabeçalho do gráfico)
      await waitFor(() => {
        expect(screen.getAllByText(/R\$\s*4\.972,00/i).length).toBeGreaterThan(0);
      });

      // Faturamento Líquido (Subtotal) R$ 4.520,00
      expect(screen.getByText(/R\$\s*4\.520,00/i)).toBeDefined();

      // Gorjetas (10%) R$ 452,00
      expect(screen.getByText(/R\$\s*452,00/i)).toBeDefined();

      // Ticket Médio R$ 103,58
      expect(screen.getByText(/R\$\s*103,58/i)).toBeDefined();

      // Alertas de estoque crítico
      expect(screen.getByText('críticos')).toBeDefined();

      // Breakdown de Pagamento: Pix, Cartão e Dinheiro
      expect(screen.getByText(/Pix/i)).toBeDefined();
      expect(screen.getByText(/Cartão/i)).toBeDefined();
      expect(screen.getByText(/Dinheiro/i)).toBeDefined();

      // Preview dos itens mais vendidos da Curva ABC
      expect(screen.getByText('Hambúrguer Artesanal Vapt')).toBeDefined();
      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
    });
  });

  describe('4. CurvaAbcView (Story 16.2 - M10 Curva ABC de Pareto 80/15/5)', () => {
    it('deve calcular os totais por Classe A, B e C e permitir filtrar por categoria', async () => {
      renderComQueryClient(<CurvaAbcView />);

      await waitFor(() => {
        expect(screen.getByText(/Curva ABC de Produtos/i)).toBeDefined();
      });

      // Cards de Classe A, B e C
      await waitFor(() => {
        expect(screen.getByText(/Classe A · Até 80%/i)).toBeDefined();
      });
      expect(screen.getByText(/Classe B · 80% a 95%/i)).toBeDefined();
      expect(screen.getByText(/Classe C · Últimos 5%/i)).toBeDefined();

      // Badges na tabela
      expect(screen.getAllByText('Classe A').length).toBeGreaterThan(0);
      expect(screen.getByText('Classe B')).toBeDefined();
      expect(screen.getByText('Classe C')).toBeDefined();

      // Filtro de Categoria
      const btnBebidas = screen.getByRole('button', { name: /^Bebidas/i });
      fireEvent.click(btnBebidas);

      // Apenas a cerveja deve permanecer
      expect(screen.getByText('Cerveja Artesanal IPA')).toBeDefined();
      expect(screen.queryByText('Hambúrguer Artesanal Vapt')).toBeNull();
    });
  });

  describe('5. DesempenhoGarconsView (Story 16.2 - M11 Produtividade e Comissões)', () => {
    it('deve renderizar rankings individuais, destaques de pódio e cálculo de 10% de comissão', async () => {
      renderComQueryClient(<DesempenhoGarconsView />);

      await waitFor(() => {
        expect(screen.getByText(/Desempenho da Equipe e Comissões/i)).toBeDefined();
      });

      // Equipe consolidada (22 + 16 + 10 = 48 comandas)
      await waitFor(() => {
        expect(screen.getByText('48')).toBeDefined();
      });

      // Garçons listados no pódio e na tabela detalhada
      expect(screen.getAllByText('Lucas Silva').length).toBe(2);
      expect(screen.getAllByText('Ana Oliveira').length).toBe(2);
      expect(screen.getAllByText('Rodrigo Costa').length).toBe(2);

      // Comissão de 10% do garçom #1 (R$ 240,00) no pódio e na tabela
      expect(screen.getAllByText(/240,00/).length).toBeGreaterThan(0);
    });
  });

  describe('6. EstoqueAlertasView (Story 16.2 - M05 Alertas de Estoque)', () => {
    it('deve exibir banner de atenção para itens zerados e tabela com barras de nível', async () => {
      renderComQueryClient(<EstoqueAlertasView />);

      await waitFor(() => {
        expect(screen.getByText(/Controle de Estoque e Alertas/i)).toBeDefined();
      });

      // Banner crítico de zerados
      await waitFor(() => {
        expect(screen.getByText(/Atenção: 1 produto\(s\) com estoque zerado/i)).toBeDefined();
      });

      // Produtos listados
      expect(screen.getByText('Refrigerante Cola Zero')).toBeDefined();
      expect(screen.getByText('Pão Brioche Especial')).toBeDefined();

      // Badges de nível
      expect(screen.getByText('Zerado')).toBeDefined();
      expect(screen.getByText('Baixo')).toBeDefined();
    });
  });

  describe('7. ModalExportacao (Story 16.2 - M15 Exportação de Relatórios)', () => {
    it('deve permitir selecionar relatório, formato e acionar download', async () => {
      const mockDownload = vi.spyOn(gestaoApi, 'acionarDownloadNavegador').mockImplementation(() => {});

      const onClose = vi.fn();

      renderComQueryClient(
        <ModalExportacao isOpen={true} onClose={onClose} />,
      );

      expect(screen.getByText(/Exportação de Relatórios Gerenciais \(M15\)/i)).toBeDefined();

      // Alternar formato para JSON
      const btnJson = screen.getByText(/JSON \(Estruturado\)/i);
      fireEvent.click(btnJson);

      // Clicar em Gerar e Baixar Arquivo
      const btnGerar = screen.getByRole('button', { name: /Gerar e Baixar Arquivo/i });
      fireEvent.click(btnGerar);

      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledTimes(1);
      });
    });
  });
});
