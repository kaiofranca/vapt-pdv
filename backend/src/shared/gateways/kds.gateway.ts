/**
 * Gateway de Integração com o microsserviço satélite kds-service (:3001).
 * Responsável pelo despacho HTTP síncrono de fichas de preparo com timeout estrito de 2000ms.
 * (ADR-01, ADR-07, RN17, RN22)
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

export interface IKdsGateway {
  despacharFicha(dados: DespacharFichaInput): Promise<RespostaDespachoKds>;
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
}

export class FakeKdsGateway implements IKdsGateway {
  public fichasDespachadas: DespacharFichaInput[] = [];
  public simularTimeout = false;
  public simularErroConexao = false;
  public proximoStatusRetorno = 201;

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
}
