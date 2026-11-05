import { apiClient } from './apiClient';
import type {
  Comanda,
  ItemComanda,
  AbrirComandaDto,
  LancarItemDto,
  AjustarItemDto,
  FecharComandaDto,
  PagarComandaDto,
  ListarComandasFiltros,
} from '../types/api';

export const comandasApi = {
  listar: (filtros?: ListarComandasFiltros) =>
    apiClient.get<Comanda[]>('/comandas', filtros as Record<string, string | number | boolean | undefined>),

  consultarPorId: (id: number) =>
    apiClient.get<Comanda>(`/comandas/${id}`),

  abrir: (dto: AbrirComandaDto) =>
    apiClient.post<Comanda>('/comandas', dto),

  lancarItem: (comandaId: number, dto: LancarItemDto) =>
    apiClient.post<ItemComanda>(`/comandas/${comandaId}/itens`, dto),

  lancarItensLote: async (comandaId: number, itens: LancarItemDto[]): Promise<ItemComanda[]> => {
    const resultados: ItemComanda[] = [];
    for (const item of itens) {
      const lancado = await apiClient.post<ItemComanda>(`/comandas/${comandaId}/itens`, item);
      resultados.push(lancado);
    }
    return resultados;
  },

  ajustarItem: (comandaId: number, itemId: number, dto: AjustarItemDto) =>
    apiClient.patch<ItemComanda>(`/comandas/${comandaId}/itens/${itemId}`, dto),

  removerItem: (comandaId: number, itemId: number) =>
    apiClient.delete<void>(`/comandas/${comandaId}/itens/${itemId}`),

  fechar: (comandaId: number, dto: FecharComandaDto) =>
    apiClient.post<Comanda>(`/comandas/${comandaId}/fechar`, dto),

  pagar: (comandaId: number, dto: PagarComandaDto) =>
    apiClient.post<Comanda>(`/comandas/${comandaId}/pagar`, dto),

  cancelar: (comandaId: number, motivo?: string) =>
    apiClient.post<Comanda>(`/comandas/${comandaId}/cancelar`, motivo ? { motivo } : {}),

  transferirMesa: (comandaId: number, novaMesa: number | string) =>
    apiClient.patch<Comanda>(`/comandas/${comandaId}/transferir-mesa`, { nova_mesa: novaMesa }),

  mesclar: (comandaDestinoId: number, comandaOrigemId: number) =>
    apiClient.post<Comanda>(`/comandas/${comandaDestinoId}/mesclar`, { comanda_origem_id: comandaOrigemId }),
};
