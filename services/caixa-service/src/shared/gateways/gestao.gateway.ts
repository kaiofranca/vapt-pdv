/**
 * Gateway de Integração com o microsserviço satélite gestao-service (:3003).
 * Responsável pelo envio síncrono/assíncrono resiliente de eventos operacionais
 * (comanda.paga, comanda.fechada, estoque.movimentado) com timeout estrito de 2000ms
 * e degradação graciosa (ASR-04, ADR-01, ADR-07, SM-C2).
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

export type GestaoGateway = IGestaoGateway;

export class HttpGestaoGateway implements IGestaoGateway {
  private readonly gestaoApiUrl: string;

  constructor(
    gestaoApiUrl?: string,
    private readonly logger?: { warn: (msg: string) => void; error?: (msg: string) => void },
  ) {
    this.gestaoApiUrl = (
      gestaoApiUrl ??
      process.env.GESTAO_SERVICE_URL ??
      process.env.GESTAO_API_URL ??
      'http://localhost:3003'
    ).replace(/\/+$/, '');
  }

  async notificarEvento(evento: Record<string, unknown>): Promise<RespostaNotificacaoGestao> {
    const url = `${this.gestaoApiUrl}/gestao/eventos`;

    try {
      const res = await fetch(url, {
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
        corpo = await res.json();
      } catch {
        // Corpo não-JSON ignorado
      }

      if (res.status === 200 || res.status === 202 || res.ok) {
        return {
          sucesso: true,
          duplicado: corpo?.duplicado ?? (res.status === 200),
          statusCode: res.status,
          dados: corpo,
        };
      }

      this.logger?.warn?.(
        `[GestaoGateway] Notificação ao gestao-service retornou status HTTP ${res.status}`,
      );

      return {
        sucesso: false,
        statusCode: res.status,
        erro: `gestao-service retornou status HTTP ${res.status}`,
        dados: corpo,
      };
    } catch (erro: any) {
      // Degradação graciosa (ADR-07, SM-C2): timeout ou indisponibilidade NUNCA reverte o pagamento
      const mensagem = erro?.message || 'Falha de rede ou timeout ao conectar ao gestao-service';
      this.logger?.warn?.(
        `[GestaoGateway] Falha na comunicação com gestao-service: ${mensagem}. Degradação graciosa ativada.`,
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
