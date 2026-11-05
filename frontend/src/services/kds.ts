import type { FichaKds, PendenciasKdsResposta, StatusFichaKds } from '../types/api';

const KDS_BASE_URL = (import.meta.env.VITE_KDS_URL as string | undefined) ?? 'http://localhost:3001';

export const kdsApi = {
  listarFichas: async (filtros?: { setor?: string; status?: string; mesa?: number }): Promise<FichaKds[]> => {
    const params = new URLSearchParams();
    if (filtros?.setor) params.append('setor', filtros.setor);
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.mesa) params.append('mesa', String(filtros.mesa));

    const url = `${KDS_BASE_URL}/kds/fichas${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Erro ao listar fichas KDS: ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.fichas ?? [];
  },

  atualizarStatus: async (fichaId: number, status: StatusFichaKds): Promise<FichaKds> => {
    const url = `${KDS_BASE_URL}/kds/fichas/${fichaId}/status`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Erro ao atualizar status da ficha: ${res.statusText}`);
    }
    return res.json();
  },

  consultarPendencias: async (comandaId: number): Promise<PendenciasKdsResposta> => {
    const url = `${KDS_BASE_URL}/kds/comandas/${comandaId}/pendencias`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return {
        comanda_id: comandaId,
        possui_pendencias: false,
        total_pendencias: 0,
        fichas_pendentes: [],
      };
    }
    return res.json();
  },
};
