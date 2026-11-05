import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kdsApi } from '../api/kdsApi';
import type { StatusFichaKds } from '../types';

export const KDS_QUERY_KEYS = {
  fichas: (estacao?: string) => ['kds', 'fichas', estacao || 'todas'] as const,
  pendencias: (comandaId: number) => ['kds', 'pendencias', comandaId] as const,
};

export function useKdsFichas(estacao: string = 'todas') {
  return useQuery({
    queryKey: KDS_QUERY_KEYS.fichas(estacao),
    queryFn: () =>
      kdsApi.listarFichas({
        estacao: estacao === 'todas' ? undefined : estacao,
        status: 'recebido,em_preparo,pronto',
      }),
    refetchInterval: 5000,
  });
}

export function useAtualizarStatusFicha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      alterado_por,
    }: {
      id: number;
      status: StatusFichaKds;
      alterado_por?: string;
    }) => kdsApi.atualizarStatusFicha(id, status, alterado_por),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds'] });
    },
  });
}
