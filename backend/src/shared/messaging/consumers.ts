import { ClienteBanco } from '../prisma';
import type { ServicoProdutos } from '../../modules/produtos/servico';
import {
  LoggerConsumidor,
  registrarConsumidorIdempotente,
} from './consumer.helper';
import { OutboxPublisher } from './outbox.publisher';
import { CanalAmqp, FILAS } from './topology';

async function executarEmTransacao<T>(
  prisma: ClienteBanco,
  operacao: (tx: ClienteBanco) => Promise<T>,
): Promise<T> {
  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(operacao);
  }
  return operacao(prisma);
}

export async function registrarConsumidoresCore(
  canal: CanalAmqp,
  prisma: ClienteBanco,
  produtosService: ServicoProdutos,
  outboxPublisher?: OutboxPublisher,
  logger?: LoggerConsumidor,
): Promise<void> {
  await registrarConsumidorIdempotente<{
    evento_id?: string;
    evento?: string;
    item_comanda_id?: unknown;
  }>(canal, {
    fila: FILAS.PDV_ITEM_PRONTO,
    logger,
    processar: async (payload, { eventoId }) => {
      const itemComandaId = Number(payload.item_comanda_id);
      if (!Number.isInteger(itemComandaId) || itemComandaId < 1) {
        throw new Error(
          `Payload item.pronto inválido: item_comanda_id="${String(payload.item_comanda_id)}".`,
        );
      }

      return executarEmTransacao(prisma, async (tx) => {
        if (tx.eventoProcessado) {
          const jaProcessado = await tx.eventoProcessado.findUnique({
            where: { eventoId },
          });
          if (jaProcessado) {
            return { duplicado: true };
          }
        }

        if (tx.itemComanda) {
          await tx.itemComanda.updateMany({
            where: { id: itemComandaId },
            data: { status_preparo: 'pronto' },
          });
        }

        if (tx.eventoProcessado) {
          await tx.eventoProcessado.create({
            data: {
              eventoId,
              evento: 'item.pronto',
            },
          });
        }

        return { duplicado: false };
      });
    },
  });

  await registrarConsumidorIdempotente<{
    evento_id?: string;
    evento?: string;
    comanda_id?: unknown;
    forma_pagamento?: unknown;
    itens?: Array<{ produto_id?: unknown; quantidade?: unknown }>;
  }>(canal, {
    fila: FILAS.PRODUTOS_COMANDA_PAGA,
    logger,
    processar: async (payload, { eventoId }) => {
      const comandaId = Number(payload.comanda_id);
      if (!Number.isInteger(comandaId) || comandaId < 1) {
        throw new Error(
          `Payload comanda.paga inválido: comanda_id="${String(payload.comanda_id)}".`,
        );
      }

      if (!Array.isArray(payload.itens) || payload.itens.length === 0) {
        throw new Error(
          `Payload comanda.paga inválido: itens ausentes ou vazios para comanda #${comandaId}.`,
        );
      }

      const itens = payload.itens.map((item, indice) => {
        const produtoId = Number(item?.produto_id);
        const quantidade = Number(item?.quantidade);
        if (
          !Number.isInteger(produtoId) ||
          produtoId < 1 ||
          !Number.isInteger(quantidade) ||
          quantidade < 1
        ) {
          throw new Error(
            `Payload comanda.paga inválido no item[${indice}] da comanda #${comandaId}.`,
          );
        }
        return {
          produto_id: produtoId,
          quantidade,
        };
      });

      const formaPagamento =
        typeof payload.forma_pagamento === 'string' &&
        payload.forma_pagamento.trim()
          ? payload.forma_pagamento.trim()
          : undefined;

      const resultado = await executarEmTransacao(prisma, async (tx) => {
        if (tx.eventoProcessado) {
          const jaProcessado = await tx.eventoProcessado.findUnique({
            where: { eventoId },
          });
          if (jaProcessado) {
            return { duplicado: true };
          }
        }

        await produtosService.baixarEstoque(
          {
            comanda_id: comandaId,
            itens,
            motivo: `VENDA_COMANDA #${comandaId}`,
            forma_pagamento: formaPagamento,
          },
          tx,
        );

        if (tx.eventoProcessado) {
          await tx.eventoProcessado.create({
            data: {
              eventoId,
              evento: 'comanda.paga',
            },
          });
        }

        return { duplicado: false };
      });

      if (!resultado.duplicado) {
        outboxPublisher?.notificarNovoEvento();
      }

      return resultado;
    },
  });
}
