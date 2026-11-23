import {
  CanalAmqp,
  MAX_TENTATIVAS_CONSUMO,
  MensagemAmqp,
  PREFETCH_PADRAO,
} from './topology';

export interface ContextoConsumoAmqp {
  eventoId: string;
  tipoEvento: string;
  msg: MensagemAmqp;
}

export interface LoggerConsumidor {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

export interface OpcoesConsumidorIdempotente<TPayload = Record<string, unknown>> {
  fila: string;
  prefetch?: number;
  maxTentativas?: number;
  logger?: LoggerConsumidor;
  processar: (
    payload: TPayload,
    contexto: ContextoConsumoAmqp,
  ) => Promise<unknown>;
}

/**
 * Registra um consumidor AMQP resiliente com `ack` manual pós-commit,
 * validação de envelope JSON/`evento_id`, retry com `x-retry-count` e roteamento para DLQ.
 */
export async function registrarConsumidorIdempotente<
  TPayload = Record<string, unknown>,
>(
  channel: CanalAmqp,
  opcoes: OpcoesConsumidorIdempotente<TPayload>,
): Promise<void> {
  await channel.prefetch(opcoes.prefetch ?? PREFETCH_PADRAO);

  await channel.consume(
    opcoes.fila,
    async (msg) => {
      if (!msg) {
        return;
      }

      let payload: TPayload;
      try {
        const parsed = JSON.parse(msg.content.toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Payload JSON deve ser um objeto.');
        }
        payload = parsed as TPayload;
      } catch (erro) {
        opcoes.logger?.error?.(
          { err: erro, fila: opcoes.fila },
          '[Consumidor] Payload JSON inválido; descartando mensagem para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const rawEventoId =
        (payload as Record<string, unknown>).evento_id ??
        msg.properties?.messageId;
      const eventoId =
        typeof rawEventoId === 'string' ? rawEventoId.trim() : '';

      if (!eventoId) {
        opcoes.logger?.error?.(
          { fila: opcoes.fila },
          '[Consumidor] Mensagem sem evento_id/messageId; descartando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const rawTipo =
        (payload as Record<string, unknown>).evento ??
        msg.fields?.routingKey ??
        '';
      const tipoEvento = typeof rawTipo === 'string' ? rawTipo : String(rawTipo);

      try {
        await opcoes.processar(payload, { eventoId, tipoEvento, msg });
        channel.ack(msg);
      } catch (erro) {
        const tentativasAtuais = Number(
          msg.properties?.headers?.['x-retry-count'] ?? 0,
        );
        const tentativas = Number.isFinite(tentativasAtuais)
          ? tentativasAtuais
          : 0;
        const proxima = tentativas + 1;
        const maxTentativas = opcoes.maxTentativas ?? MAX_TENTATIVAS_CONSUMO;

        if (proxima >= maxTentativas) {
          opcoes.logger?.error?.(
            { err: erro, fila: opcoes.fila, eventoId, tentativas: proxima },
            '[Consumidor] Máximo de tentativas atingido; enviando mensagem para DLQ.',
          );
          channel.nack(msg, false, false);
          return;
        }

        opcoes.logger?.warn?.(
          { err: erro, fila: opcoes.fila, eventoId, proximaTentativa: proxima },
          '[Consumidor] Falha ao processar mensagem; reenfileirando com x-retry-count.',
        );

        channel.sendToQueue(opcoes.fila, msg.content, {
          persistent: true,
          contentType: 'application/json',
          messageId: msg.properties?.messageId ?? eventoId,
          headers: {
            ...(msg.properties?.headers ?? {}),
            'x-retry-count': proxima,
          },
        });
        channel.ack(msg);
      }
    },
    { noAck: false },
  );
}
