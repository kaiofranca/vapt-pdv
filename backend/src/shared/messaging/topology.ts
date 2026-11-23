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
  routingKeys: readonly string[];
  dlq: string;
}

export const DEFINICOES_FILAS: readonly DefinicaoFila[] = [
  {
    fila: FILAS.KDS_ITEM_LANCADO,
    routingKeys: ['item.lancado', 'comanda.cancelada'],
    dlq: `${FILAS.KDS_ITEM_LANCADO}.dlq`,
  },
  {
    fila: FILAS.PDV_ITEM_PRONTO,
    routingKeys: ['item.pronto'],
    dlq: `${FILAS.PDV_ITEM_PRONTO}.dlq`,
  },
  {
    fila: FILAS.CAIXA_COMANDA_FECHADA,
    routingKeys: ['comanda.fechada'],
    dlq: `${FILAS.CAIXA_COMANDA_FECHADA}.dlq`,
  },
  {
    fila: FILAS.PRODUTOS_COMANDA_PAGA,
    routingKeys: ['comanda.paga'],
    dlq: `${FILAS.PRODUTOS_COMANDA_PAGA}.dlq`,
  },
  {
    fila: FILAS.GESTAO_EVENTOS,
    routingKeys: ['#'],
    dlq: `${FILAS.GESTAO_EVENTOS}.dlq`,
  },
];

export interface MensagemAmqp {
  content: Buffer;
  fields?: {
    routingKey?: string;
    deliveryTag?: number;
    redelivered?: boolean;
    exchange?: string;
    consumerTag?: string;
    [key: string]: unknown;
  };
  properties: {
    messageId?: string;
    contentType?: string;
    headers?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface CanalAmqp {
  assertExchange(
    exchange: string,
    type: string,
    options?: {
      durable?: boolean;
      autoDelete?: boolean;
      [key: string]: unknown;
    },
  ): Promise<unknown>;
  assertQueue(
    queue: string,
    options?: {
      durable?: boolean;
      arguments?: Record<string, unknown>;
      [key: string]: unknown;
    },
  ): Promise<unknown>;
  bindQueue(
    queue: string,
    source: string,
    pattern: string,
    args?: unknown,
  ): Promise<unknown>;
  prefetch(count: number, global?: boolean): Promise<unknown>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Record<string, unknown>,
  ): boolean;
  sendToQueue(
    queue: string,
    content: Buffer,
    options?: Record<string, unknown>,
  ): boolean;
  consume(
    queue: string,
    onMessage: (msg: MensagemAmqp | null) => void,
    options?: { noAck?: boolean; [key: string]: unknown },
  ): Promise<unknown>;
  ack(message: any, allUpTo?: boolean): void;
  nack(message: any, allUpTo?: boolean, requeue?: boolean): void;
  close?(): Promise<void>;
  waitForConfirms?(): Promise<void>;
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
