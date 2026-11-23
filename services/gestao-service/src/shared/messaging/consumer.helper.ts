import {
  CanalAmqp,
  MAX_TENTATIVAS_CONSUMO,
  MensagemAmqp,
  PREFETCH_PADRAO,
} from './topology';
import { LoggerMensageria } from './rabbitmq.client';

export interface MetadadosMensagemAmqp {
  eventoId: string;
  tipoEvento: string;
  routingKey: string;
  tentativas: number;
  mensagemOriginal: MensagemAmqp;
}

export interface OpcoesConsumidorIdempotente<TPayload = Record<string, unknown>> {
  fila: string;
  prefetch?: number;
  maxTentativas?: number;
  logger?: LoggerMensageria;
  processar: (
    payload: TPayload,
    meta: MetadadosMensagemAmqp,
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

      let payload: Record<string, unknown>;
      try {
        const parsed = JSON.parse(msg.content.toString('utf-8')) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Payload AMQP deve ser um objeto JSON.');
        }
        payload = parsed as Record<string, unknown>;
      } catch (erro) {
        opcoes.logger?.error?.(
          { fila: opcoes.fila, erro },
          'JSON inválido recebido na fila AMQP. Encaminhando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const eventoId =
        typeof payload.evento_id === 'string' && payload.evento_id.trim().length > 0
          ? payload.evento_id.trim()
          : typeof msg.properties?.messageId === 'string' && msg.properties.messageId.trim().length > 0
            ? msg.properties.messageId.trim()
            : '';

      if (!eventoId) {
        opcoes.logger?.error?.(
          { fila: opcoes.fila },
          'Mensagem AMQP sem evento_id ou messageId. Encaminhando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const tipoEvento =
        typeof payload.evento === 'string' && payload.evento.trim().length > 0
          ? payload.evento.trim()
          : typeof msg.fields?.routingKey === 'string' && msg.fields.routingKey.trim().length > 0
            ? msg.fields.routingKey.trim()
            : typeof msg.properties?.type === 'string' && msg.properties.type.trim().length > 0
              ? msg.properties.type.trim()
              : '';

      const headers = (msg.properties?.headers ?? {}) as Record<string, unknown>;
      const tentativasBruto = Number(headers['x-retry-count'] ?? 0);
      const tentativasAtuais =
        Number.isFinite(tentativasBruto) && tentativasBruto >= 0 ? tentativasBruto : 0;

      try {
        await opcoes.processar(payload as TPayload, {
          eventoId,
          tipoEvento,
          routingKey: msg.fields?.routingKey ?? '',
          tentativas: tentativasAtuais,
          mensagemOriginal: msg,
        });

        channel.ack(msg);
      } catch (erro) {
        const proxima = tentativasAtuais + 1;

        if (proxima >= maxTentativas) {
          opcoes.logger?.error?.(
            { fila: opcoes.fila, eventoId, tentativas: proxima, erro },
            'Limite de retentativas atingido. Enviando mensagem para DLQ.',
          );
          channel.nack(msg, false, false);
          return;
        }

        opcoes.logger?.warn?.(
          { fila: opcoes.fila, eventoId, tentativa: proxima, erro },
          'Falha ao processar mensagem AMQP. Reenfileirando para retry.',
        );

        channel.sendToQueue(opcoes.fila, msg.content, {
          persistent: true,
          deliveryMode: 2,
          contentType: msg.properties?.contentType ?? 'application/json',
          messageId: msg.properties?.messageId ?? eventoId,
          type: msg.properties?.type ?? (tipoEvento || undefined),
          headers: {
            ...headers,
            'x-retry-count': proxima,
          },
        });
        channel.ack(msg);
      }
    },
    { noAck: false },
  );
}
