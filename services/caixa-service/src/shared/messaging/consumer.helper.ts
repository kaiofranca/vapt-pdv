import {
  CanalAmqp,
  MAX_TENTATIVAS_CONSUMO,
  MensagemAmqp,
  PREFETCH_PADRAO,
} from './topology';
import { LoggerMensageria } from './rabbitmq.client';

export interface ContextoMensagemConsumida<TPayload = Record<string, unknown>> {
  eventoId: string;
  payload: TPayload;
  mensagemOriginal: MensagemAmqp;
  tentativa: number;
}

export interface OpcoesConsumidorIdempotente<TPayload = Record<string, unknown>> {
  fila: string;
  prefetch?: number;
  maxTentativas?: number;
  logger?: LoggerMensageria;
  processar: (contexto: ContextoMensagemConsumida<TPayload>) => Promise<unknown>;
}

function extrairTentativas(msg: MensagemAmqp): number {
  const bruto = msg.properties?.headers?.['x-retry-count'];
  if (typeof bruto === 'number' && Number.isFinite(bruto) && bruto >= 0) {
    return Math.floor(bruto);
  }
  const convertido = Number(bruto);
  if (Number.isFinite(convertido) && convertido > 0) {
    return Math.floor(convertido);
  }
  return 0;
}

export async function registrarConsumidorIdempotente<
  TPayload = Record<string, unknown>,
>(
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

      let payloadAnalisado: unknown;
      try {
        payloadAnalisado = JSON.parse(msg.content.toString('utf-8'));
      } catch (erro) {
        opcoes.logger?.error?.(
          { erro, fila: opcoes.fila },
          '[ConsumidorAMQP] Payload JSON corrompido. Descartando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      if (
        payloadAnalisado === null ||
        typeof payloadAnalisado !== 'object' ||
        Array.isArray(payloadAnalisado)
      ) {
        opcoes.logger?.error?.(
          { fila: opcoes.fila },
          '[ConsumidorAMQP] Payload não é um objeto JSON válido. Descartando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const objetoPayload = payloadAnalisado as Record<string, unknown>;
      const eventoIdBruto =
        typeof objetoPayload.evento_id === 'string' && objetoPayload.evento_id.trim()
          ? objetoPayload.evento_id.trim()
          : typeof msg.properties?.messageId === 'string' && msg.properties.messageId.trim()
            ? msg.properties.messageId.trim()
            : '';

      if (!eventoIdBruto) {
        opcoes.logger?.error?.(
          { fila: opcoes.fila },
          '[ConsumidorAMQP] Mensagem sem evento_id ou messageId. Descartando para DLQ.',
        );
        channel.nack(msg, false, false);
        return;
      }

      const tentativasAtuais = extrairTentativas(msg);

      try {
        await opcoes.processar({
          eventoId: eventoIdBruto,
          payload: payloadAnalisado as TPayload,
          mensagemOriginal: msg,
          tentativa: tentativasAtuais + 1,
        });

        channel.ack(msg);
      } catch (erro) {
        const proximaTentativa = tentativasAtuais + 1;

        if (proximaTentativa < maxTentativas) {
          const headersAtuais = (msg.properties?.headers ?? {}) as Record<string, unknown>;
          opcoes.logger?.warn?.(
            {
              erro,
              fila: opcoes.fila,
              eventoId: eventoIdBruto,
              tentativa: proximaTentativa,
              maxTentativas,
            },
            '[ConsumidorAMQP] Falha ao processar mensagem. Reenfileirando com x-retry-count.',
          );

          try {
            channel.sendToQueue(opcoes.fila, msg.content, {
              ...msg.properties,
              persistent: true,
              deliveryMode: 2,
              contentType: msg.properties?.contentType ?? 'application/json',
              messageId: msg.properties?.messageId ?? eventoIdBruto,
              headers: {
                ...headersAtuais,
                'x-retry-count': proximaTentativa,
              },
            });
            channel.ack(msg);
          } catch (erroReenvio) {
            opcoes.logger?.error?.(
              { erro: erroReenvio, fila: opcoes.fila, eventoId: eventoIdBruto },
              '[ConsumidorAMQP] Erro ao reenviar mensagem para retry. Roteando para DLQ.',
            );
            channel.nack(msg, false, false);
          }
          return;
        }

        opcoes.logger?.error?.(
          {
            erro,
            fila: opcoes.fila,
            eventoId: eventoIdBruto,
            tentativas: proximaTentativa,
          },
          '[ConsumidorAMQP] Limite máximo de tentativas atingido. Roteando para DLQ.',
        );
        channel.nack(msg, false, false);
      }
    },
    { noAck: false },
  );
}
