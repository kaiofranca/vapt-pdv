import { apiClient } from './apiClient';
import type {
  Usuario,
  CriarUsuarioDto,
  AtualizarUsuarioDto,
  ListarUsuariosFiltros,
} from '../types/api';

export const usuariosApi = {
  listar: (filtros?: ListarUsuariosFiltros) =>
    apiClient.get<Usuario[]>('/usuarios', filtros as Record<string, string | number | boolean | undefined>),

  consultarPorId: (id: number) =>
    apiClient.get<Usuario>(`/usuarios/${id}`),

  criar: (dto: CriarUsuarioDto) =>
    apiClient.post<Usuario>('/usuarios', dto),

  atualizar: (id: number, dto: AtualizarUsuarioDto) =>
    apiClient.patch<Usuario>(`/usuarios/${id}`, dto),

  inativar: (id: number) =>
    apiClient.post<Usuario>(`/usuarios/${id}/inativar`),

  validarGarcom: (id: number) =>
    apiClient.get<{ id: number; nome: string; valido: boolean }>(`/usuarios/${id}/validar-garcom`),
};
