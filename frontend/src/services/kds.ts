import type {
  FichaKds,
  PendenciasKdsResposta,
  StatusFichaKds,
  ItemPendenciaKds,
  RespostaChecagemPendenciasKds,
} from '../types/api';

const KDS_BASE_URL =
  (import.meta.env.VITE_KDS_URL as string | undefined) ??
  (import.meta.env.VITE_KDS_API_URL as string | undefined) ??
  'http://localhost:3001';

/**
 * Consulta a situação dos itens no KDS (:3001) para a comanda informada.
 * Aplica timeout estrito de 2000ms e degradação graciosa caso o serviço esteja offline ou em timeout.
 * (Story 2.2.9, RF23, C04, ADR-07)
 */
export const obterPendenciasComanda = async (
  comandaId: number
): Promise<RespostaChecagemPendenciasKds> => {
  const url = `${KDS_BASE_URL}/kds/comandas/${comandaId}/pendencias`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      console.warn(
        `[KDS] Consulta de pendências da comanda #${comandaId} retornou HTTP ${res.status}. Degradação suave ativada.`
      );
      return {
        possui_pendencias: false,
        pendencias: [],
        offline: true,
      };
    }

    const data = await res.json();
    const listaBruta = Array.isArray(data.pendencias)
      ? data.pendencias
      : Array.isArray(data.itens)
        ? data.itens
        : [];

    const pendencias: ItemPendenciaKds[] = listaBruta.map((item: any) => ({
      id: Number(item.id ?? item.ficha_id ?? 0),
      item_comanda_id: Number(item.item_comanda_id ?? 0),
      produto_id: Number(item.produto_id ?? 0),
      nome_produto: String(item.nome_produto ?? ''),
      setor: String(item.setor ?? item.estacao ?? 'cozinha'),
      status: String(item.status ?? 'recebido'),
      quantidade: item.quantidade !== undefined ? Number(item.quantidade) : 1,
      recebido_em: String(item.recebido_em ?? ''),
    }));

    // Se o payload já forneceu pendências diretamente (ex: testes/mocks), mantém a lista.
    // Se forneceu lista bruta de todos os itens do KDS, filtra os que não foram entregues nem cancelados.
    const itensPendentes = data.pendencias
      ? pendencias
      : pendencias.filter((it) => it.status !== 'entregue' && it.status !== 'cancelado');

    const possui_pendencias =
      data.possui_pendencias !== undefined
        ? Boolean(data.possui_pendencias)
        : itensPendentes.length > 0;

    return {
      possui_pendencias,
      pendencias: itensPendentes,
      offline: false,
    };
  } catch (erro: any) {
    console.warn(
      `[KDS] Falha na checagem de pendências da comanda #${comandaId} (${erro?.message}). Degradação suave ativada.`
    );
    return {
      possui_pendencias: false,
      pendencias: [],
      offline: true,
    };
  }
};

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

  obterPendenciasComanda,
};
