/**
/**
 * Cliente HTTP para o Microsserviço Satélite Caixa-Service (:3002)
 *
 * Responsável por:
 * 1. Split payment igualitário e por itens com conservação de 100% dos centavos (RN19).
 * 2. Quitação de comanda em dinheiro, pix e cartão com cálculo de troco oficial pelo satélite.
 * 3. Consulta de recibo térmico operacional canônico (.paper) de 48 colunas (RN24).
 * 4. Tratamento robusto de erros e degradação graciosa em caso de indisponibilidade (ADR-07, EARS-CXSAT-10).
 */

function resolverCaixaBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_CAIXA_API_URL as string | undefined)?.trim();
  if (envUrl && !envUrl.includes('seu_ip_publico_ec2')) {
    return envUrl.replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return `http://${window.location.hostname}:3002`;
  }
  return 'http://localhost:3002';
}

export const CAIXA_API_URL = resolverCaixaBaseUrl();

export class CaixaSatError extends Error {
  public readonly statusHttp: number;
  public readonly codigo: string;
  public readonly detalhes?: any;

  constructor(statusHttp: number, codigo: string, mensagem: string, detalhes?: any) {
    super(mensagem);
    this.name = 'CaixaSatError';
    this.statusHttp = statusHttp;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export interface CotaSat {
  numero_cota: number;
  rotulo: string;
  valor: string; // Ex: "33.34"
  saldo?: string;
  status?: string;
  subtotal?: string;
  taxa_servico?: string;
  itens?: any[];
}

export interface DividirComandaParams {
  tipo?: 'igualitaria' | 'personalizada';
  modo?: 'pessoas' | 'itens';
  quantidade_pessoas?: number;
  pessoas?: number;
  cotas?: Array<{
    rotulo?: string;
    numero?: number;
    valor?: string;
    itens?: Array<{ item_comanda_id: number; quantidade: number }>;
  }>;
  itens_selecionados?: Array<{
    rotulo?: string;
    itens: Array<{ item_comanda_id: number; quantidade: number }>;
  }>;
}

export interface DividirResposta {
  comanda_id: number;
  mesa: number;
  modo: string;
  pessoas: number;
  total_comanda: string;
  saldo_a_dividir: string;
  cotas: CotaSat[];
}

export interface PagarComandaParams {
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao';
  valor_recebido?: string;
  valor?: string;
  valor_aplicado?: string;
  numero_cota?: number;
  numero_parcela?: number;
  pagador_label?: string;
  pagador_rotulo?: string;
  operador_nome?: string;
}

export interface ParcelaRegistradaSat {
  id: number;
  numero_parcela: number;
  pagador_rotulo: string | null;
  forma_pagamento: string;
  valor_aplicado: string;
  valor_recebido: string;
  troco: string;
  criado_em: string;
}

export interface ReciboResumoSat {
  id: number;
  numero_recibo: number;
  codigo_autenticacao: string;
  emitido_em: string;
}

export interface PagarComandaResposta {
  comanda_id: number;
  mesa: number;
  status: string;
  aplicar_taxa_servico: boolean;
  subtotal: string;
  taxa_servico: string;
  total: string;
  valor_pago: string;
  saldo_restante: string;
  troco_total: string;
  parcela_registrada: ParcelaRegistradaSat;
  recibo: ReciboResumoSat | null;
  avisos: string[];
}

export interface ReciboItemSat {
  nome: string;
  quantidade: number;
  preco_unitario: string;
  subtotal: string;
}

export interface ReciboCompletoResposta {
  id: number;
  numero_recibo: number;
  comanda_id: number;
  mesa: number;
  garcom_nome: string;
  operador_caixa?: string;
  codigo_autenticacao: string;
  subtotal: string;
  taxa_servico: string;
  total: string;
  troco_total: string;
  itens: ReciboItemSat[];
  pagamentos: ParcelaRegistradaSat[];
  emitido_em: string;
  paper_text: string;
}

export interface CobrancaDetalheResposta {
  id: number;
  comanda_id: number;
  mesa: number;
  garcom_id: number;
  garcom_nome?: string;
  nome_cliente: string | null;
  status: string;
  aplicar_taxa_servico: boolean;
  subtotal: string;
  taxa_servico: string;
  total: string;
  valor_pago: string;
  saldo_restante: string;
  troco_total: string;
  pessoas_divisao: number;
  modo_divisao: string;
  itens: Array<{
    item_comanda_id: number;
    produto_id: number;
    nome: string;
    preco_unitario: string;
    quantidade: number;
    subtotal: string;
  }>;
  parcelas: ParcelaRegistradaSat[];
  divisao_detalhes?: any;
  cotas?: CotaSat[];
  fechada_em: string;
  paga_em: string | null;
}

/**
 * Realiza requisições HTTP para o satélite caixa-service com timeout e formatação de erros padronizada.
 */
async function requestCaixa<T>(
  caminho: string,
  opcoes: RequestInit = {},
  timeoutMs: number = 3000,
): Promise<T> {
  const url = `${CAIXA_API_URL}${caminho}`;
  let controller: AbortController | null = null;
  let timer: any = null;

  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), timeoutMs);
  }

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      signal: controller ? controller.signal : undefined,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opcoes.headers || {}),
      },
    });

    if (timer) clearTimeout(timer);

    if (!resposta.ok) {
      let dadosErro: any = null;
      try {
        dadosErro = await resposta.json();
      } catch {
        dadosErro = null;
      }

      const codigo =
        dadosErro?.erro?.codigo ||
        (resposta.status === 422
          ? 'VALOR_PAGAMENTO_INVALIDO'
          : resposta.status === 503
          ? 'SERVICO_INDISPONIVEL'
          : resposta.status === 404
          ? 'NAO_ENCONTRADO'
          : 'ERRO_SATELITE');

      const mensagem =
        dadosErro?.erro?.mensagem ||
        dadosErro?.message ||
        `Erro retornado pelo caixa-service (:3002): HTTP ${resposta.status}`;

      throw new CaixaSatError(
        resposta.status,
        codigo,
        mensagem,
        dadosErro?.erro?.detalhes || dadosErro,
      );
    }

    return (await resposta.json()) as T;
  } catch (erro: any) {
    if (timer) clearTimeout(timer);

    if (erro instanceof CaixaSatError) {
      throw erro;
    }

    // Se for abortado por timeout ou falha de conexão (CORS/offline)
    const isTimeout = erro?.name === 'AbortError' || erro?.code === 20;
    const msgAmigavel = isTimeout
      ? 'Tempo limite de resposta do caixa-service (:3002) esgotado.'
      : 'O serviço satélite de Frente de Caixa (:3002) está indisponível ou inacessível no momento.';

    throw new CaixaSatError(503, 'SERVICO_INDISPONIVEL', msgAmigavel, {
      originalError: erro?.message,
    });
  }
}

/**
 * Calcula divisão local preservando 100% dos centavos (resíduo alocado no último participante).
 * Utilizado como fallback gracioso em contingência quando o satélite está offline (RN19).
 */
export function calcularDivisaoLocal(total: string | number, pessoas: number): CotaSat[] {
  const qtdPessoas = Math.max(2, pessoas);
  const totalNum = typeof total === 'string' ? parseFloat(total.replace(',', '.')) : total;
  const totalCentavos = Math.round((Number.isFinite(totalNum) ? totalNum : 0) * 100);

  const baseCentavos = Math.floor(totalCentavos / qtdPessoas);
  const residuoCentavos = totalCentavos - baseCentavos * qtdPessoas;

  const cotas: CotaSat[] = [];
  for (let i = 1; i <= qtdPessoas; i++) {
    const valorCentavos = i === qtdPessoas ? baseCentavos + residuoCentavos : baseCentavos;
    cotas.push({
      numero_cota: i,
      rotulo: `Pessoa ${i}`,
      valor: (valorCentavos / 100).toFixed(2),
      status: 'pendente',
    });
  }
  return cotas;
}

/**
 * Formata texto do recibo operacional térmico em padrão de 48 colunas (.paper)
 */
export function formatarRecibo48Colunas(dados: {
  comanda_id: number;
  mesa: number | string;
  garcom_nome?: string;
  operador_caixa?: string;
  codigo_autenticacao: string;
  emitido_em?: string;
  subtotal: string;
  taxa_servico?: string;
  total: string;
  troco_total?: string;
  itens?: Array<{ nome: string; quantidade: number; preco_unitario?: string; subtotal: string }>;
  pagamentos?: Array<{
    forma_pagamento: string;
    valor_aplicado: string;
    valor_recebido?: string;
    troco?: string;
    pagador_rotulo?: string | null;
  }>;
}): string {
  const LARGURA = 48;
  const linhaDupla = '='.repeat(LARGURA);
  const linhaSimples = '-'.repeat(LARGURA);

  const centralizar = (texto: string) => {
    if (texto.length >= LARGURA) return texto.slice(0, LARGURA);
    const espacos = Math.max(0, Math.floor((LARGURA - texto.length) / 2));
    return ' '.repeat(espacos) + texto;
  };

  const duasColunas = (esq: string, dir: string) => {
    const espacoDisponivel = LARGURA - esq.length - dir.length;
    if (espacoDisponivel <= 0) {
      return `${esq.slice(0, LARGURA - dir.length - 1)} ${dir}`;
    }
    return esq + ' '.repeat(espacoDisponivel) + dir;
  };

  const linhas: string[] = [
    linhaDupla,
    centralizar('VAPT PDV - BAR & RESTAURANTE'),
    centralizar('COMPROVANTE OPERACIONAL DE VENDA'),
    linhaDupla,
    duasColunas(`Mesa: ${dados.mesa}`, `Comanda: #${dados.comanda_id}`),
    `Atendente: ${dados.garcom_nome || 'Equipe de Salão'}`,
  ];

  if (dados.operador_caixa) {
    linhas.push(`Operador: ${dados.operador_caixa}`);
  }

  linhas.push(`Data: ${dados.emitido_em || new Date().toLocaleString('pt-BR')}`);
  linhas.push(linhaSimples);
  linhas.push(duasColunas('QTD  ITEM', 'VALOR'));
  linhas.push(linhaSimples);

  if (dados.itens && dados.itens.length > 0) {
    for (const item of dados.itens) {
      const rotuloItem = `${String(item.quantidade).padStart(2, ' ')}x  ${item.nome}`;
      linhas.push(duasColunas(rotuloItem, `R$ ${item.subtotal}`));
    }
  } else {
    linhas.push(centralizar('Consumo de itens diversos'));
  }

  linhas.push(linhaSimples);
  linhas.push(duasColunas('Subtotal:', `R$ ${dados.subtotal}`));
  if (dados.taxa_servico) {
    linhas.push(duasColunas('Taxa de Servico (10%):', `R$ ${dados.taxa_servico}`));
  }
  linhas.push(duasColunas('TOTAL A PAGAR:', `R$ ${dados.total}`));
  linhas.push(linhaSimples);
  linhas.push('PAGAMENTOS:');

  if (dados.pagamentos && dados.pagamentos.length > 0) {
    dados.pagamentos.forEach((p, idx) => {
      const rotulo = p.pagador_rotulo ? ` (${p.pagador_rotulo})` : '';
      const forma = p.forma_pagamento.toUpperCase();
      linhas.push(duasColunas(` ${idx + 1}. ${forma}${rotulo}`, `R$ ${p.valor_aplicado}`));
      if (p.forma_pagamento.toLowerCase() === 'dinheiro' && p.valor_recebido) {
        linhas.push(
          duasColunas(
            `    Recebido: R$ ${p.valor_recebido}`,
            `Troco: R$ ${p.troco || '0.00'}`,
          ),
        );
      }
    });
  } else {
    linhas.push(duasColunas(' Quitação:', `R$ ${dados.total}`));
  }

  if (dados.troco_total && parseFloat(dados.troco_total) > 0) {
    linhas.push(linhaSimples);
    linhas.push(duasColunas('Troco Total Devolvido:', `R$ ${dados.troco_total}`));
  }

  linhas.push(linhaSimples);
  linhas.push('Codigo de Autenticacao:');
  linhas.push(centralizar(dados.codigo_autenticacao));
  linhas.push(linhaDupla);
  linhas.push(centralizar('Obrigado pela preferencia!'));
  linhas.push(centralizar('Volte sempre!'));
  linhas.push(linhaDupla);

  return linhas.join('\n');
}

/**
 * Cliente HTTP unificado do Caixa Satélite (:3002)
 */
export const caixaSatApi = {
  /**
   * Sincroniza / Abre fechamento de comanda no satélite
   */
  async sincronizarComanda(comandaId: number, body: any): Promise<CobrancaDetalheResposta> {
    return requestCaixa<CobrancaDetalheResposta>(`/caixa/comandas/${comandaId}/fechar`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * Consulta os dados de cobrança e saldo da comanda no satélite (:3002)
   */
  async obterComandaCaixa(comandaId: number): Promise<CobrancaDetalheResposta> {
    return requestCaixa<CobrancaDetalheResposta>(`/caixa/comandas/${comandaId}`, {
      method: 'GET',
    });
  },

  /**
   * Divide a comanda igualmente por pessoas ou por itens no satélite (:3002)
   */
  async dividirComanda(
    comandaId: number,
    body: DividirComandaParams,
  ): Promise<DividirResposta> {
    const modo = body.tipo === 'personalizada' || body.modo === 'itens' ? 'itens' : 'pessoas';
    const pessoas =
      body.quantidade_pessoas ??
      body.pessoas ??
      (body.cotas ? body.cotas.length : 2);

    const payload: Record<string, any> = {
      modo,
      pessoas,
      quantidade_pessoas: pessoas,
    };

    if (body.tipo) payload.tipo = body.tipo;
    if (body.cotas) payload.cotas = body.cotas;
    if (body.itens_selecionados) payload.itens_selecionados = body.itens_selecionados;

    return requestCaixa<DividirResposta>(`/caixa/comandas/${comandaId}/dividir`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Liquida parcela ou comanda integral com cálculo oficial de troco em dinheiro (:3002)
   */
  async pagarComanda(
    comandaId: number,
    body: PagarComandaParams,
  ): Promise<PagarComandaResposta> {
    const valorAplicado =
      body.valor_aplicado ||
      body.valor ||
      (body.forma_pagamento !== 'dinheiro' ? body.valor_recebido : undefined);

    const payload: Record<string, any> = {
      forma_pagamento: body.forma_pagamento,
      valor_recebido: body.valor_recebido,
      valor_aplicado: valorAplicado,
      valor: valorAplicado,
      numero_parcela: body.numero_cota ?? body.numero_parcela,
      numero_cota: body.numero_cota,
      pagador_label: body.pagador_label || body.pagador_rotulo,
      operador_nome: body.operador_nome,
    };

    return requestCaixa<PagarComandaResposta>(`/caixa/comandas/${comandaId}/pagar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Obtém o recibo oficial autenticado de 48 colunas (.paper) emitido pelo satélite (:3002)
   */
  async obterRecibo(comandaId: number): Promise<ReciboCompletoResposta> {
    return requestCaixa<ReciboCompletoResposta>(`/caixa/recibos/${comandaId}`, {
      method: 'GET',
    });
  },
};
