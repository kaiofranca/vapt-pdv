/**
 * Gateway de Integração com o microsserviço satélite caixa-service (:3002).
 * Responsável pela sincronização HTTP síncrona do fechamento de contas com timeout estrito de 2000ms.
 * (ADR-07, RN17)
 */

export interface RespostaNotificacaoCaixa {
  sucesso: boolean;
  statusCode?: number;
  erro?: string;
  dados?: any;
}

export interface ICaixaGateway {
  notificarFechamento(
    comandaId: number,
    dados: any,
  ): Promise<RespostaNotificacaoCaixa>;
}

export class CaixaGateway implements ICaixaGateway {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ??
      process.env.CAIXA_SERVICE_URL ??
      'http://localhost:3002'
    ).replace(/\/+$/, '');
  }

  async notificarFechamento(
    comandaId: number,
    dados: any,
  ): Promise<RespostaNotificacaoCaixa> {
    const url = `${this.baseUrl}/caixa/comandas/${comandaId}/fechar`;

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(dados),
        signal: AbortSignal.timeout(2000),
      });

      if (!resposta.ok) {
        return {
          sucesso: false,
          statusCode: resposta.status,
          erro: `Caixa-service respondeu com status ${resposta.status}`,
        };
      }

      let corpoResposta: any = null;
      try {
        corpoResposta = await resposta.json();
      } catch {
        // Corpo não-JSON ignorado
      }

      return {
        sucesso: true,
        statusCode: resposta.status,
        dados: corpoResposta,
      };
    } catch (erro: any) {
      return {
        sucesso: false,
        erro:
          erro?.message ||
          'Falha de comunicação ou timeout ao conectar ao caixa-service',
      };
    }
  }
}
