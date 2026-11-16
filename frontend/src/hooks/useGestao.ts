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

export function useResumoDiario(filtros?: ResumoDiarioFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'resumo-diario', filtros?.data],
    queryFn: () => obterResumoDiario(filtros),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRankingProdutos(filtros?: RankingProdutosFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'ranking-produtos', filtros],
    queryFn: () => obterRankingProdutos(filtros),
    staleTime: 30_000,
  });
}

export function useDesempenhoGarcons() {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'desempenho-garcons'],
    queryFn: () => obterDesempenhoGarcons(),
    staleTime: 30_000,
  });
}

export function useAlertasEstoque(filtros?: AlertasEstoqueFiltros) {
  return useQuery({
    queryKey: [...GESTAO_QUERY_KEY, 'alertas-estoque', filtros],
    queryFn: () => obterAlertasEstoque(filtros),
    staleTime: 30_000,
  });
}

export function useExportarRelatorio() {
  return useMutation({
    mutationFn: async (filtros: ExportarRelatorioFiltros) => {
      const { blob, filename } = await exportarRelatorio(filtros);
      acionarDownloadNavegador(blob, filename);
      return { filename };
    },
  });
}
