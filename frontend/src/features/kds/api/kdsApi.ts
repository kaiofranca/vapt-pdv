import type { FichaKds, FilaKdsResposta, RespostaPendenciasKds, StatusFichaKds } from '../types';

function resolverKdsBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_KDS_API_URL as string | undefined)?.trim();
  if (envUrl && !envUrl.includes('seu_ip_publico_ec2')) {
    return envUrl.replace(/\/+$/, '');
  }
  return '';
}

const KDS_BASE_URL = resolverKdsBaseUrl();

export const kdsApi = {
  async listarFichas(params?: {
    estacao?: string;
    setor?: string;
    status?: string;
    mesa?: number;
  }): Promise<FilaKdsResposta> {
    const query = new URLSearchParams();
    if (params?.estacao && params.estacao !== 'todas') query.append('estacao', params.estacao);
    if (params?.setor && params.setor !== 'todas') query.append('setor', params.setor);
    if (params?.status) query.append('status', params.status);
    if (params?.mesa) query.append('mesa', String(params.mesa));

    const url = `${KDS_BASE_URL}/kds/fichas${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) {
      throw new Error(`Erro ao listar fichas do KDS: HTTP ${res.status}`);
    }
    return res.json();
  },

  async atualizarStatusFicha(
    id: number,
    status: StatusFichaKds,
    alterado_por?: string,
  ): Promise<FichaKds> {
    const res = await fetch(`${KDS_BASE_URL}/kds/fichas/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, alterado_por }),
    });
    if (!res.ok) {
      throw new Error(`Erro ao atualizar status da ficha: HTTP ${res.status}`);
    }
    return res.json();
  },

  async consultarPendencias(comandaId: number): Promise<RespostaPendenciasKds> {
    try {
      const res = await fetch(`${KDS_BASE_URL}/kds/comandas/${comandaId}/pendencias`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) {
        return { comanda_id: comandaId, possui_pendencias: false, total_pendencias: 0, itens: [] };
      }
      return res.json();
    } catch {
      return { comanda_id: comandaId, possui_pendencias: false, total_pendencias: 0, itens: [] };
    }
  },
};
