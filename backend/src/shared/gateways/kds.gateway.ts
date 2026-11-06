/**
 * Gateway de Integração com o microsserviço satélite kds-service (:3001).
 * Responsável pelo despacho HTTP síncrono de fichas de preparo e checagem de pendências ativas
 * com timeout estrito de 2000ms.
 * (ADR-01, ADR-07, RN17, RN22, Story 2.2.9, RF23, C04)
 */

export interface DespacharFichaInput {
  comanda_id: number;
  item_comanda_id: number;
  produto_id: number;
  mesa: number;
  garcom_id: number;
  nome_garcom?: string | null;
  nome_produto: string;
  setor?: 'cozinha' | 'bar';
  quantidade: number;
  observacao?: string | null;
}

export interface RespostaDespachoKds {
  sucesso: boolean;
  statusCode?: number;
  fichaId?: number;
  erro?: string;
}

export interface ItemPendenciaKds {
  id: number;
  item_comanda_id: number;
  produto_id?: number;
  nome_produto: string;
  setor: string;
  status: string;
  quantidade?: number;
  recebido_em?: string;
}

export interface RespostaConsultaPendenciasKds {
  possui_pendencias: boolean;
  pendencias: ItemPendenciaKds[];
  offline?: boolean;
}

export interface IKdsGateway {
  despacharFicha(dados: DespacharFichaInput): Promise<RespostaDespachoKds>;
  consultarPendencias(comandaId: number): Promise<RespostaConsultaPendenciasKds>;
}

export class HttpKdsGateway implements IKdsGateway {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ??
      process.env.KDS_SERVICE_URL ??
      'http://localhost:3001'
    ).replace(/\/+$/, '');
  }

  async despacharFicha(dados: DespacharFichaInput): Promise<RespostaDespachoKds> {
    if (process.env.KDS_SERVICE_URL === 'disabled') {
      return { sucesso: true };
    }

    const url = `${this.baseUrl}/kds/fichas`;
    const payload = {
      comanda_id: dados.comanda_id,
      item_comanda_id: dados.item_comanda_id,
      mesa: dados.mesa,
      garcom_id: dados.garcom_id,
      nome_garcom: dados.nome_garcom ?? undefined,
      setor: dados.setor ?? 'cozinha',
      produto_id: dados.produto_id,
      nome_produto: dados.nome_produto,
      quantidade: dados.quantidade,
      observacao: dados.observacao ?? undefined,
    };

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
      });

      if (!resposta.ok) {
        const bodyErro = await resposta.text().catch(() => '');
        return {
          sucesso: false,
          statusCode: resposta.status,
          erro: `HTTP ${resposta.status}: ${bodyErro || resposta.statusText}`,
        };
      }

      const dadosResposta = (await resposta.json().catch(() => ({}))) as any;
      return {
        sucesso: true,
        statusCode: resposta.status,
        fichaId: dadosResposta?.id,
      };
    } catch (erro: any) {
      return {
        sucesso: false,
        erro: erro?.message ?? 'Erro desconhecido ao conectar ao KDS',
      };
    }
  }

  async consultarPendencias(comandaId: number): Promise<RespostaConsultaPendenciasKds> {
    if (process.env.KDS_SERVICE_URL === 'disabled') {
      return { possui_pendencias: false, pendencias: [], offline: false };
    }

    const url = `${this.baseUrl}/kds/comandas/${comandaId}/pendencias`;
    try {
      const resposta = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2000),
      });

      if (!resposta.ok) {
        return { possui_pendencias: false, pendencias: [], offline: true };
      }

      const data: any = await resposta.json().catch(() => ({}));
      const rawItens = Array.isArray(data.pendencias)
        ? data.pendencias
        : Array.isArray(data.itens)
          ? data.itens
          : [];

      const pendencias: ItemPendenciaKds[] = rawItens.map((item: any) => ({
        id: Number(item.id ?? item.ficha_id ?? 0),
        item_comanda_id: Number(item.item_comanda_id ?? 0),
        produto_id: Number(item.produto_id ?? 0),
        nome_produto: String(item.nome_produto ?? ''),
        setor: String(item.setor ?? item.estacao ?? 'cozinha'),
        status: String(item.status ?? 'recebido'),
        quantidade: item.quantidade !== undefined ? Number(item.quantidade) : 1,
        recebido_em: String(item.recebido_em ?? ''),
      }));

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
    } catch {
      return { possui_pendencias: false, pendencias: [], offline: true };
    }
  }
}

export class FakeKdsGateway implements IKdsGateway {
  public fichasDespachadas: DespacharFichaInput[] = [];
  public simularTimeout = false;
  public simularErroConexao = false;
  public proximoStatusRetorno = 201;
  public pendenciasPorComanda = new Map<number, RespostaConsultaPendenciasKds>();

  async despacharFicha(dados: DespacharFichaInput): Promise<RespostaDespachoKds> {
    if (this.simularTimeout) {
      return {
        sucesso: false,
        erro: 'The operation was aborted due to timeout',
      };
    }

    if (this.simularErroConexao) {
      return {
        sucesso: false,
        erro: 'connect ECONNREFUSED 127.0.0.1:3001',
      };
    }

    this.fichasDespachadas.push(dados);
    return {
      sucesso: true,
      statusCode: this.proximoStatusRetorno,
      fichaId: this.fichasDespachadas.length,
    };
  }

  async consultarPendencias(comandaId: number): Promise<RespostaConsultaPendenciasKds> {
    if (this.simularTimeout || this.simularErroConexao) {
      return { possui_pendencias: false, pendencias: [], offline: true };
    }

    return (
      this.pendenciasPorComanda.get(comandaId) ?? {
        possui_pendencias: false,
        pendencias: [],
        offline: false,
      }
    );
  }
}
