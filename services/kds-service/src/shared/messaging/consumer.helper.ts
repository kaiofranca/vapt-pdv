import {
  CanalAmqp,
  MAX_TENTATIVAS_CONSUMO,
  MensagemAmqp,
  PREFETCH_PADRAO,
} from './topology';

export interface MetaMensagemAmqp {
  eventoId: string;
  tentativa: number;
  msg: MensagemAmqp;
}

export interface OpcoesConsumidorIdempotente<TPayload = Record<string, unknown>> {
  fila: string;
  prefetch?: number;
  maxTentativas?: number;
  logger?: {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
  processar: (
    payload: TPayload,
    meta: MetaMensagemAmqp,
  ) => Promise<{ duplicado?: boolean } | void>;
}

export async function registrarConsumidorIdempotente<TPayload = Record<string, unknown>>(
  channel: CanalAmqp,
  opcoes: OpcoesConsumidorIdempotente<TPayload>,
): Promise<unknown> {
  const prefetch = opcoes.prefetch ?? PREFETCH_PADRAO;
  const maxTentativas = opcoes.maxTentativas ?? MAX_TENTATIVAS_CONSUMO;

  await channel.prefetch(prefetch);

  return channel.consume(
    opcoes.fila,
    async (msg) => {
      if (!msg) {
        return;
      }

      let payload: any;

      try {
        payload = JSON.parse(msg.content.toString('utf-8'));
      } catch (erro) {
        opcoes.logger?.warn?.(
          { err: erro, fila: opcoes.fila },
          'Payload JSON inválido/corrompido recebido no consumidor. Encaminhando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        opcoes.logger?.warn?.(
          { fila: opcoes.fila },
          'Payload JSON não é um objeto válido. Encaminhando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const eventoIdBruto =
        (typeof payload.evento_id === 'string' && payload.evento_id.trim()) ||
        (typeof msg.properties?.messageId === 'string' && msg.properties.messageId.trim()) ||
        '';

      if (!eventoIdBruto) {
        opcoes.logger?.warn?.(
          { fila: opcoes.fila },
          'Mensagem sem evento_id ou messageId. Encaminhando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const headers = msg.properties?.headers ?? {};
      const tentativaAtual = Number(headers['x-retry-count'] ?? 0);
      const tentativaSegura =
        Number.isFinite(tentativaAtual) && tentativaAtual >= 0 ? tentativaAtual : 0;

      try {
        await opcoes.processar(payload as TPayload, {
          eventoId: eventoIdBruto,
          tentativa: tentativaSegura,
          msg,
        });

        channel.ack(msg);
      } catch (erro) {
        const proximaTentativa = tentativaSegura + 1;

        if (proximaTentativa < maxTentativas) {
          opcoes.logger?.warn?.(
            {
              err: erro,
              fila: opcoes.fila,
              eventoId: eventoIdBruto,
              tentativa: proximaTentativa,
              maxTentativas,
            },
            'Falha ao processar mensagem; reenfileirando para retry controlado.',
          );

          const opcoesPublicacao = {
            persistent: true,
            deliveryMode: 2,
            messageId:
              typeof msg.properties?.messageId === 'string' && msg.properties.messageId.trim()
                ? msg.properties.messageId
                : eventoIdBruto,
            contentType: msg.properties?.contentType ?? 'application/json',
            timestamp: Date.now(),
            headers: {
              ...headers,
              'x-retry-count': proximaTentativa,
            },
          };

          try {
            if (typeof channel.sendToQueue === 'function') {
              channel.sendToQueue(opcoes.fila, msg.content, opcoesPublicacao);
            } else {
              channel.publish('', opcoes.fila, msg.content, opcoesPublicacao);
            }
            channel.ack(msg);
          } catch (erroRepublicacao) {
            opcoes.logger?.error?.(
              { err: erroRepublicacao, fila: opcoes.fila, eventoId: eventoIdBruto },
              'Falha ao republicar mensagem para retry. Encaminhando para DLQ.',
            );
            channel.nack(msg, false, false);
          }
        } else {
          opcoes.logger?.error?.(
            {
              err: erro,
              fila: opcoes.fila,
              eventoId: eventoIdBruto,
              tentativa: proximaTentativa,
              maxTentativas,
            },
            'Número máximo de tentativas excedido. Encaminhando mensagem para DLQ.',
          );
          channel.nack(msg, false, false);
        }
      }
    },
    { noAck: false },
  );
}
