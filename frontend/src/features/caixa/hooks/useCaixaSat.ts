import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  caixaSatApi,
  type DividirComandaParams,
  type PagarComandaParams,
  type DividirResposta,
  type PagarComandaResposta,
  type ReciboCompletoResposta,
  type CobrancaDetalheResposta,
} from '../api/caixaSatApi';

export function useComandaCaixaSat(comandaId: number | null, options?: { enabled?: boolean }) {
  return useQuery<CobrancaDetalheResposta, Error>({
    queryKey: ['caixa-sat', 'comanda', comandaId],
    queryFn: () => caixaSatApi.obterComandaCaixa(comandaId!),
    enabled: !!comandaId && (options?.enabled ?? true),
    retry: 1,
  });
}

export function useDividirComandaSat() {
  const queryClient = useQueryClient();

  return useMutation<DividirResposta, Error, { comandaId: number; body: DividirComandaParams }>({
    mutationFn: ({ comandaId, body }) => caixaSatApi.dividirComanda(comandaId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-sat', 'comanda', variables.comandaId] });
    },
  });
}

export function usePagarComandaSat() {
  const queryClient = useQueryClient();

  return useMutation<PagarComandaResposta, Error, { comandaId: number; body: PagarComandaParams }>({
    mutationFn: ({ comandaId, body }) => caixaSatApi.pagarComanda(comandaId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-sat', 'comanda', variables.comandaId] });
      queryClient.invalidateQueries({ queryKey: ['caixa-sat', 'recibo', variables.comandaId] });
      queryClient.invalidateQueries({ queryKey: ['comandas'] });
    },
  });
}

export function useReciboSat(comandaId: number | null, options?: { enabled?: boolean }) {
  return useQuery<ReciboCompletoResposta, Error>({
    queryKey: ['caixa-sat', 'recibo', comandaId],
    queryFn: () => caixaSatApi.obterRecibo(comandaId!),
    enabled: !!comandaId && (options?.enabled ?? true),
    retry: 1,
  });
}
