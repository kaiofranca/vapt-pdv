import type { ApiErrorDetail, ApiErrorResponse } from '../types/api';

export class ApiError extends Error {
  public readonly codigo: string;
  public readonly detalhes?: Record<string, unknown>;
  public readonly status: number;

  constructor(status: number, erro: ApiErrorDetail) {
    super(erro.mensagem || 'Ocorreu um erro na requisição');
    this.name = 'ApiError';
    this.status = status;
    this.codigo = erro.codigo || 'ERRO_DESCONHECIDO';
    this.detalhes = erro.detalhes;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (restOptions.body && typeof restOptions.body === 'string') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      if (isJson && data && typeof data === 'object' && 'erro' in data) {
        const errorResponse = data as ApiErrorResponse;
        throw new ApiError(response.status, errorResponse.erro);
      }

      let mensagem = response.statusText || 'Erro inesperado na requisição';
      if (typeof data === 'string' && data.trim()) {
        mensagem = data;
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (typeof obj.mensagem === 'string') {
          mensagem = obj.mensagem;
        } else if (typeof obj.message === 'string') {
          mensagem = obj.message;
        }
      }

      throw new ApiError(response.status, {
        codigo: `HTTP_${response.status}`,
        mensagem,
        detalhes: typeof data === 'object' ? (data as Record<string, unknown>) : undefined,
      });
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(503, {
      codigo: 'SERVICO_INDISPONIVEL',
      mensagem: 'Não foi possível comunicar com o servidor da API. Verifique a conexão.',
      detalhes: { originalError: String(err) },
    });
  }
}

export const apiClient = {
  get: <T>(url: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(url, { method: 'GET', params }),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
