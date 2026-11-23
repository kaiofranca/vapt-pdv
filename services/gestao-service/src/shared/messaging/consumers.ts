import { GestaoService } from '../../modules/gestao/gestao.service';
import { EnvelopeEventoOperacional } from '../../modules/gestao/schemas';
import { registrarConsumidorIdempotente } from './consumer.helper';
import { LoggerMensageria } from './rabbitmq.client';
import { CanalAmqp, FILAS } from './topology';

/**
 * Registra o consumidor AMQP da fila gestao.eventos (binding '#') delegando o envelope
 * validado para processamento idempotente e projeção OLAP no GestaoService.
 */
export async function registrarConsumidorGestao(
  canal: CanalAmqp,
  gestaoService: Pick<GestaoService, 'processarEvento'>,
  logger?: LoggerMensageria,
): Promise<unknown> {
  return registrarConsumidorIdempotente<Record<string, unknown>>(canal, {
    fila: FILAS.GESTAO_EVENTOS,
    logger,
    processar: async (payload, meta) => {
      const eventoIdBruto = payload.evento_id ?? meta.eventoId;
      const eventoId = typeof eventoIdBruto === 'string' ? eventoIdBruto.trim() : '';

      const tipoEventoBruto =
        typeof payload.evento === 'string' && payload.evento.trim().length > 0
          ? payload.evento
          : meta.tipoEvento;
      const evento = typeof tipoEventoBruto === 'string' ? tipoEventoBruto.trim() : '';

      if (!eventoId || !evento) {
        throw new Error('Mensagem AMQP inválida para gestão: evento_id e evento são obrigatórios.');
      }

      const envelope: EnvelopeEventoOperacional = {
        ...(payload as Partial<EnvelopeEventoOperacional>),
        evento_id: eventoId,
        evento,
      };

      const res = await gestaoService.processarEvento(envelope);
      return { duplicado: res.duplicado };
    },
  });
}
