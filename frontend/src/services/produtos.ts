import { apiClient } from './apiClient';
import type {
  Produto,
  CriarProdutoDto,
  ListarProdutosFiltros,
} from '../types/api';

export const produtosApi = {
  listar: (filtros?: ListarProdutosFiltros) =>
    apiClient.get<Produto[]>('/produtos', filtros as Record<string, string | number | boolean | undefined>),

  consultarPorId: (id: number) =>
    apiClient.get<Produto>(`/produtos/${id}`),

  criar: (dto: CriarProdutoDto) =>
    apiClient.post<Produto>('/produtos', dto),

  atualizar: (id: number, dto: Partial<CriarProdutoDto>) =>
    apiClient.patch<Produto>(`/produtos/${id}`, dto),

  inativar: (id: number) =>
    apiClient.post<Produto>(`/produtos/${id}/inativar`),

  repor: (id: number, quantidade: number, motivo?: string) =>
    apiClient.post<{ produto: Produto; movimento: unknown }>(`/produtos/${id}/repor`, {
      quantidade,
      motivo,
    }),

  consultarDisponibilidade: (id: number, quantidade: number) =>
    apiClient.get<{
      id: number;
      nome: string;
      preco: string;
      ativo: boolean;
      estoque: number;
      disponivel: boolean;
    }>(`/produtos/${id}/disponibilidade`, { quantidade }),
};
