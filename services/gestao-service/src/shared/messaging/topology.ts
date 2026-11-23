export const EXCHANGE_EVENTOS = 'vaptpdv.eventos';
export const EXCHANGE_DLX = 'vaptpdv.eventos.dlx';

export const MAX_TENTATIVAS_CONSUMO = 3;
export const PREFETCH_PADRAO = 10;

export const FILAS = {
  KDS_ITEM_LANCADO: 'kds.item.lancado',
  PDV_ITEM_PRONTO: 'pdv.item.pronto',
  CAIXA_COMANDA_FECHADA: 'caixa.comanda.fechada',
  PRODUTOS_COMANDA_PAGA: 'produtos.comanda.paga',
  GESTAO_EVENTOS: 'gestao.eventos',
} as const;

export interface DefinicaoFila {
  fila: string;
  dlq: string;
  routingKeys: readonly string[];
}

export const DEFINICOES_FILAS: readonly DefinicaoFila[] = [
  {
    fila: FILAS.KDS_ITEM_LANCADO,
    dlq: `${FILAS.KDS_ITEM_LANCADO}.dlq`,
    routingKeys: ['item.lancado', 'comanda.cancelada'],
  },
  {
    fila: FILAS.PDV_ITEM_PRONTO,
    dlq: `${FILAS.PDV_ITEM_PRONTO}.dlq`,
    routingKeys: ['item.pronto'],
  },
  {
    fila: FILAS.CAIXA_COMANDA_FECHADA,
    dlq: `${FILAS.CAIXA_COMANDA_FECHADA}.dlq`,
    routingKeys: ['comanda.fechada'],
  },
  {
    fila: FILAS.PRODUTOS_COMANDA_PAGA,
    dlq: `${FILAS.PRODUTOS_COMANDA_PAGA}.dlq`,
    routingKeys: ['comanda.paga'],
  },
  {
    fila: FILAS.GESTAO_EVENTOS,
    dlq: `${FILAS.GESTAO_EVENTOS}.dlq`,
    routingKeys: ['#'],
  },
];

export interface MensagemAmqp {
  content: Buffer;
  fields: {
    routingKey?: string;
    exchange?: string;
    deliveryTag?: number;
    redelivered?: boolean;
  };
  properties: {
    messageId?: string;
    contentType?: string;
    type?: string;
    headers?: Record<string, any>;
  };
}

export interface CanalAmqp {
  assertExchange(
    exchange: string,
    type: string,
    options?: { durable?: boolean; autoDelete?: boolean; [key: string]: any },
  ): Promise<unknown>;
  assertQueue(
    queue: string,
    options?: { durable?: boolean; arguments?: Record<string, any>; [key: string]: any },
  ): Promise<unknown>;
  bindQueue(
    queue: string,
    source: string,
    pattern: string,
    args?: Record<string, any>,
  ): Promise<unknown>;
  prefetch(count: number, global?: boolean): Promise<unknown>;
  consume(
    queue: string,
    onMessage: (msg: MensagemAmqp | null) => void,
    options?: { noAck?: boolean; consumerTag?: string; [key: string]: any },
  ): Promise<unknown>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Record<string, any>,
  ): boolean;
  sendToQueue(
    queue: string,
    content: Buffer,
    options?: Record<string, any>,
  ): boolean;
  ack(message: MensagemAmqp, allUpTo?: boolean): void;
  nack(message: MensagemAmqp, allUpTo?: boolean, requeue?: boolean): void;
  waitForConfirms?(): Promise<void>;
  close?(): Promise<void>;
}

export async function declararTopologiaRabbitMQ(channel: CanalAmqp): Promise<void> {
  await channel.assertExchange(EXCHANGE_EVENTOS, 'topic', {
    durable: true,
    autoDelete: false,
  });

  await channel.assertExchange(EXCHANGE_DLX, 'direct', {
    durable: true,
    autoDelete: false,
  });

  for (const def of DEFINICOES_FILAS) {
    await channel.assertQueue(def.dlq, { durable: true });
    await channel.bindQueue(def.dlq, EXCHANGE_DLX, def.dlq);

    await channel.assertQueue(def.fila, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGE_DLX,
        'x-dead-letter-routing-key': def.dlq,
      },
    });

    for (const routingKey of def.routingKeys) {
      await channel.bindQueue(def.fila, EXCHANGE_EVENTOS, routingKey);
    }
  }
}
