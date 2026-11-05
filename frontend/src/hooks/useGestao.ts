import { useQuery, useMutation } from '@tanstack/react-query';
import {
  obterResumoDiario,
  obterRankingProdutos,
  obterDesempenhoGarcons,
  obterAlertasEstoque,
  exportarRelatorio,
  acionarDownloadNavegador,
} from '../services/gestao';
import type {
  ResumoDiarioFiltros,
  RankingProdutosFiltros,
  AlertasEstoqueFiltros,
  ExportarRelatorioFiltros,
} from '../types/api';

export const GESTAO_QUERY_KEY = ['gestao'] as const;

/**
 * Hook para obter o resumo diário consolidado (M01 / M09)
 * staleTime: 30s, refetchInterval: 60s conforme convenção de doc 08
 */
export function useResumoDiario(filtros?: ResumoDiarioFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'resumo-diario', filtros?.data],
    queryFn: () => obterResumoDiario(filtros),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Hook para obter o ranking de produtos e curva ABC 80/15/5 (M10)
 */
export function useRankingProdutos(filtros?: RankingProdutosFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'ranking-produtos', filtros],
    queryFn: () => obterRankingProdutos(filtros),
    staleTime: 30_000,
  });
}

/**
 * Hook para obter o desempenho e comissões de 10% da equipe de garçons (M11)
 */
export function useDesempenhoGarcons() {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'desempenho-garcons'],
    queryFn: () => obterDesempenhoGarcons(),
    staleTime: 30_000,
  });
}

/**
 * Hook para obter os alertas de estoque crítico ou abaixo do mínimo (M05)
 */
export function useAlertasEstoque(filtros?: AlertasEstoqueFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'alertas-estoque', filtros],
    queryFn: () => obterAlertasEstoque(filtros),
    staleTime: 30_000,
  });
}

/**
 * Mutação para exportar relatórios em CSV ou JSON e disparar o download no browser (M15)
 */
export function useExportarRelatorio() {
  return useMutation({
    mutationFn: async (filtros: ExportarRelatorioFiltros) => {
      const { blob, filename } = await exportarRelatorio(filtros);
      acionarDownloadNavegador(blob, filename);
      return { filename };
    },
  });
}
