import { CobrancasService } from '../../modules/caixa/cobrancas.service';
import { ItemSnapshotInput } from '../../modules/caixa/schemas';
import { registrarConsumidorIdempotente } from './consumer.helper';
import { LoggerMensageria } from './rabbitmq.client';
import {
  CanalAmqp,
  FILAS,
  MAX_TENTATIVAS_CONSUMO,
  PREFETCH_PADRAO,
} from './topology';

export interface ControleEventoProcessadoDelegate {
  findUnique(args: {
    where: { eventoId: string };
  }): Promise<{ eventoId: string; evento?: string; processadoEm?: Date } | null>;
  create(args: {
    data: { eventoId: string; evento: string; processadoEm?: Date };
  }): Promise<unknown>;
}

export interface ControleEventosProcessados {
  eventoProcessado: ControleEventoProcessadoDelegate;
}

export interface PayloadComandaFechada {
  evento_id?: string;
  evento?: string;
  comanda_id?: unknown;
  mesa?: unknown;
  garcom_id?: unknown;
  garcom_nome?: unknown;
  nome_cliente?: unknown;
  aplicar_taxa_servico?: unknown;
  itens?: unknown;
}

function validarPayloadComandaFechada(payload: PayloadComandaFechada): {
  comandaId: number;
  mesa: number;
  garcomId: number;
  itens: ItemSnapshotInput[];
} {
  if (payload.evento !== undefined && payload.evento !== 'comanda.fechada') {
    throw new Error(`Evento inesperado na fila caixa.comanda.fechada: ${String(payload.evento)}`);
  }

  const comandaId = Number(payload.comanda_id);
  if (!Number.isInteger(comandaId) || comandaId < 1) {
    throw new Error('Payload comanda.fechada inválido: comanda_id deve ser inteiro positivo.');
  }

  const mesa = Number(payload.mesa);
  if (!Number.isInteger(mesa) || mesa < 1) {
    throw new Error('Payload comanda.fechada inválido: mesa deve ser inteiro positivo.');
  }

  const garcomId = Number(payload.garcom_id);
  if (!Number.isInteger(garcomId) || garcomId < 1) {
    throw new Error('Payload comanda.fechada inválido: garcom_id deve ser inteiro positivo.');
  }

  if (!Array.isArray(payload.itens) || payload.itens.length === 0) {
    throw new Error('Payload comanda.fechada inválido: itens deve ser um array não-vazio.');
  }

  return {
    comandaId,
    mesa,
    garcomId,
    itens: payload.itens as ItemSnapshotInput[],
  };
}

/**
 * Registra o consumidor idempotente do caixa-service na fila `caixa.comanda.fechada`.
 */
export async function registrarConsumidorCaixa(
  canal: CanalAmqp,
  prismaOuControle: ControleEventosProcessados,
  cobrancasService: CobrancasService,
  logger?: LoggerMensageria,
): Promise<unknown> {
  return registrarConsumidorIdempotente<PayloadComandaFechada>(canal, {
    fila: FILAS.CAIXA_COMANDA_FECHADA,
    prefetch: PREFETCH_PADRAO,
    maxTentativas: MAX_TENTATIVAS_CONSUMO,
    logger,
    processar: async ({ eventoId, payload }) => {
      const jaProcessado = await prismaOuControle.eventoProcessado.findUnique({
        where: { eventoId },
      });

      if (jaProcessado) {
        logger?.debug?.(
          { eventoId, fila: FILAS.CAIXA_COMANDA_FECHADA },
          '[ConsumidorCaixa] Evento duplicado ignorado com sucesso.',
        );
        return { duplicado: true };
      }

      const { comandaId, mesa, garcomId, itens } = validarPayloadComandaFechada(payload);

      await cobrancasService.fecharOuRecalcular(comandaId, {
        mesa,
        garcom_id: garcomId,
        garcom_nome:
          typeof payload.garcom_nome === 'string' ? payload.garcom_nome : undefined,
        nome_cliente:
          payload.nome_cliente === null || typeof payload.nome_cliente === 'string'
            ? payload.nome_cliente
            : undefined,
        aplicar_taxa_servico:
          typeof payload.aplicar_taxa_servico === 'boolean'
            ? payload.aplicar_taxa_servico
            : undefined,
        itens,
      });

      await prismaOuControle.eventoProcessado.create({
        data: {
          eventoId,
          evento: 'comanda.fechada',
        },
      });

      return { duplicado: false, comandaId };
    },
  });
}
