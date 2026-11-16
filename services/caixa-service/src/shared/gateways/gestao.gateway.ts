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
