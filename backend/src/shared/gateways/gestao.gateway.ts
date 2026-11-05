/**
 * Gateway de Integração com o microsserviço satélite gestao-service (:3003).
 * Responsável pelo envio síncrono/assíncrono de eventos operacionais
 * (comanda.paga, comanda.fechada, estoque.movimentado) com timeout estrito de 2000ms
 * e degradação graciosa pós-commit (ASR-04, ADR-01, ADR-07).
 */

export interface RespostaNotificacaoGestao {
  sucesso: boolean;
  duplicado?: boolean;
  statusCode?: number;
  erro?: string;
  dados?: any;
}

export interface IGestaoGateway {
  notificarEvento(evento: Record<string, unknown>): Promise<RespostaNotificacaoGestao>;
  notificarComandaPaga(evento: Record<string, unknown>): Promise<RespostaNotificacaoGestao>;
}

export class HttpGestaoGateway implements IGestaoGateway {
  private readonly baseUrl: string;

  constructor(
    baseUrl?: string,
    private readonly logger?: { warn: (msg: string) => void; error?: (msg: string) => void },
  ) {
    this.baseUrl = (
      baseUrl ??
      process.env.GESTAO_SERVICE_URL ??
      process.env.GESTAO_API_URL ??
      'http://localhost:3003'
    ).replace(/\/+$/, '');
  }

  async notificarEvento(evento: Record<string, unknown>): Promise<RespostaNotificacaoGestao> {
    const url = `${this.baseUrl}/gestao/eventos`;

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(evento),
        signal: AbortSignal.timeout(2000),
      });

      let corpo: any = null;
      try {
        corpo = await resposta.json();
      } catch {
        // Corpo não-JSON ignorado
      }

      if (resposta.status === 200 || resposta.status === 202 || resposta.ok) {
        return {
          sucesso: true,
          duplicado: corpo?.duplicado ?? (resposta.status === 200),
          statusCode: resposta.status,
          dados: corpo,
        };
      }

      this.logger?.warn?.(
        `[GestaoGateway] Notificação ao gestao-service retornou status HTTP ${resposta.status}`,
      );

      return {
        sucesso: false,
        statusCode: resposta.status,
        erro: `gestao-service respondeu com status HTTP ${resposta.status}`,
        dados: corpo,
      };
    } catch (erro: any) {
      // Degradação graciosa (ADR-07): indisponibilidade ou timeout NUNCA impede o encerramento da venda
      const mensagem =
        erro?.message || 'Falha de comunicação ou timeout ao conectar ao gestao-service';

      this.logger?.warn?.(
        `[GestaoGateway] Falha na comunicação com o gestao-service: ${mensagem}. Degradação graciosa ativada.`,
      );

      return {
        sucesso: false,
        erro: mensagem,
      };
    }
  }

  async notificarComandaPaga(evento: Record<string, unknown>): Promise<RespostaNotificacaoGestao> {
    return this.notificarEvento(evento);
  }
}

export class GestaoGateway extends HttpGestaoGateway {}
