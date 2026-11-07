import { request } from './apiClient';
import type {
  ResumoDiarioGestao,
  ResumoDiarioFiltros,
  RankingProdutosResposta,
  RankingProdutosFiltros,
  DesempenhoGarconsResposta,
  AlertasEstoqueResposta,
  AlertasEstoqueFiltros,
  ExportarRelatorioFiltros,
} from '../types/api';

function resolverGestaoBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_GESTAO_API_URL as string | undefined)?.trim();
  if (envUrl && !envUrl.includes('seu_ip_publico_ec2')) {
    return envUrl.replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return `http://${window.location.hostname}:3003`;
  }
  return '';
}

export const GESTAO_BASE_URL = resolverGestaoBaseUrl();

/**
 * Consulta o resumo diário e faturamento (M01 / M09)
 */
export async function obterResumoDiario(
  filtros?: ResumoDiarioFiltros,
): Promise<ResumoDiarioGestao> {
  return request<ResumoDiarioGestao>(`${GESTAO_BASE_URL}/gestao/resumo-diario`, {
    params: {
      data: filtros?.data,
    },
  });
}

/**
 * Consulta o ranking de produtos com Curva ABC 80/15/5 (M10)
 */
export async function obterRankingProdutos(
  filtros?: RankingProdutosFiltros,
): Promise<RankingProdutosResposta> {
  return request<RankingProdutosResposta>(`${GESTAO_BASE_URL}/gestao/ranking-produtos`, {
    params: {
      limite: filtros?.limite,
      categoria: filtros?.categoria,
    },
  });
}

/**
 * Consulta o desempenho e comissões da equipe de garçons (M11)
 */
export async function obterDesempenhoGarcons(): Promise<DesempenhoGarconsResposta> {
  return request<DesempenhoGarconsResposta>(`${GESTAO_BASE_URL}/gestao/desempenho-garcons`);
}

/**
 * Consulta a lista de produtos com estoque em nível de alerta ou crítico (M05)
 */
export async function obterAlertasEstoque(
  filtros?: AlertasEstoqueFiltros,
): Promise<AlertasEstoqueResposta> {
  return request<AlertasEstoqueResposta>(`${GESTAO_BASE_URL}/gestao/alertas-estoque`, {
    params: {
      apenas_ativos: filtros?.apenas_ativos,
    },
  });
}

/**
 * Realiza download direto do relatório exportado em CSV ou JSON (M15)
 */
export async function exportarRelatorio(
  filtros: ExportarRelatorioFiltros = {},
): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  if (filtros.tipo) params.append('tipo', filtros.tipo);
  if (filtros.formato) params.append('formato', filtros.formato);
  if (filtros.de) params.append('de', filtros.de);
  if (filtros.ate) params.append('ate', filtros.ate);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const url = `${GESTAO_BASE_URL}/gestao/exportar${queryString}`;

  const response = await fetch(url, {
    headers: {
      Accept: filtros.formato === 'json' ? 'application/json' : 'text/csv',
    },
  });

  if (!response.ok) {
    let mensagemErro = 'Falha ao exportar relatório gerencial.';
    try {
      const errJson = await response.json();
      if (errJson?.erro?.mensagem) {
        mensagemErro = errJson.erro.mensagem;
      }
    } catch {
      // Ignora erro de JSON e mantém mensagem padrão
    }
    throw new Error(mensagemErro);
  }

  // Tenta extrair filename do Content-Disposition se fornecido pelo backend
  const contentDisposition = response.headers.get('content-disposition');
  let filename = `relatorio-${filtros.tipo || 'faturamento'}.${filtros.formato || 'csv'}`;

  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Helper utilitário que engatilha o download do Blob no navegador do usuário
 */
export function acionarDownloadNavegador(blob: Blob, filename: string): void {
  const urlBlob = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = urlBlob;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(urlBlob);
}
