import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { produtosApi } from '../services/produtos';
import type { ListarProdutosFiltros, CriarProdutoDto } from '../types/api';

export const PRODUTOS_QUERY_KEY = ['produtos'] as const;

export function useProdutos(filtros?: ListarProdutosFiltros) {
  return useQuery({
    queryKey: [...PRODUTOS_QUERY_KEY, filtros],
    queryFn: () => produtosApi.listar(filtros),
    staleTime: 1000 * 30, // 30 segundos
  });
}

export function useProdutosDisponiveis() {
  return useQuery({
    queryKey: [...PRODUTOS_QUERY_KEY, { ativo: true }],
    queryFn: () => produtosApi.listar({ ativo: true }),
    staleTime: 1000 * 30,
  });
}

export function useCriarProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CriarProdutoDto) => produtosApi.criar(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUTOS_QUERY_KEY });
    },
  });
}

export function useAtualizarProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CriarProdutoDto> }) =>
      produtosApi.atualizar(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUTOS_QUERY_KEY });
    },
  });
}

export function useInativarProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => produtosApi.inativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUTOS_QUERY_KEY });
    },
  });
}

export function useReporEstoque() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      quantidade,
      motivo,
    }: {
      id: number;
      quantidade: number;
      motivo?: string;
    }) => produtosApi.repor(id, quantidade, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUTOS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['alertas-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['gestao', 'alertas-estoque'] });
    },
  });
}
