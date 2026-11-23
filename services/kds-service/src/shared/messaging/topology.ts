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
  nome: string;
  dlq: string;
  routingKeys: readonly string[];
}

export const DEFINICOES_FILAS: readonly DefinicaoFila[] = [
  {
    nome: FILAS.KDS_ITEM_LANCADO,
    dlq: `${FILAS.KDS_ITEM_LANCADO}.dlq`,
    routingKeys: ['item.lancado', 'comanda.cancelada'],
  },
  {
    nome: FILAS.PDV_ITEM_PRONTO,
    dlq: `${FILAS.PDV_ITEM_PRONTO}.dlq`,
    routingKeys: ['item.pronto'],
  },
  {
    nome: FILAS.CAIXA_COMANDA_FECHADA,
    dlq: `${FILAS.CAIXA_COMANDA_FECHADA}.dlq`,
    routingKeys: ['comanda.fechada'],
  },
  {
    nome: FILAS.PRODUTOS_COMANDA_PAGA,
    dlq: `${FILAS.PRODUTOS_COMANDA_PAGA}.dlq`,
    routingKeys: ['comanda.paga'],
  },
  {
    nome: FILAS.GESTAO_EVENTOS,
    dlq: `${FILAS.GESTAO_EVENTOS}.dlq`,
    routingKeys: ['#'],
  },
];

export interface MensagemAmqp {
  content: Buffer;
  fields: {
    routingKey: string;
    deliveryTag?: number;
    redelivered?: boolean;
    exchange?: string;
    consumerTag?: string;
  };
  properties: {
    messageId?: any;
    contentType?: any;
    headers?: Record<string, any>;
    timestamp?: any;
    deliveryMode?: any;
    [key: string]: any;
  };
}

export interface CanalAmqp {
  assertExchange(
    exchange: string,
    type: string,
    options?: { durable?: boolean; autoDelete?: boolean },
  ): Promise<unknown>;
  assertQueue(
    queue: string,
    options?: { durable?: boolean; autoDelete?: boolean; arguments?: any },
  ): Promise<unknown>;
  bindQueue(
    queue: string,
    source: string,
    pattern: string,
    args?: any,
  ): Promise<unknown>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: {
      persistent?: boolean;
      deliveryMode?: boolean | number;
      messageId?: string;
      contentType?: string;
      timestamp?: number;
      headers?: any;
    },
  ): boolean;
  sendToQueue?(
    queue: string,
    content: Buffer,
    options?: {
      persistent?: boolean;
      deliveryMode?: boolean | number;
      messageId?: string;
      contentType?: string;
      timestamp?: number;
      headers?: any;
    },
  ): boolean;
  prefetch(count: number, global?: boolean): Promise<unknown>;
  consume(
    queue: string,
    onMessage: (msg: MensagemAmqp | null) => void,
    options?: { noAck?: boolean },
  ): Promise<unknown>;
  ack(message: any, allUpTo?: boolean): void;
  nack(message: any, allUpTo?: boolean, requeue?: boolean): void;
  waitForConfirms?(): Promise<void>;
  close?(): Promise<void>;
  on?(event: string, listener: (...args: any[]) => void): any;
}

/**
 * Declara exchanges, filas duráveis, DLQs e bindings do ecossistema VaptPDV no RabbitMQ.
 */
export async function declararTopologiaRabbitMQ(channel: CanalAmqp): Promise<void> {
  await channel.assertExchange(EXCHANGE_EVENTOS, 'topic', {
    durable: true,
    autoDelete: false,
  });

  await channel.assertExchange(EXCHANGE_DLX, 'direct', {
    durable: true,
    autoDelete: false,
  });

  for (const fila of DEFINICOES_FILAS) {
    await channel.assertQueue(fila.dlq, { durable: true });
    await channel.bindQueue(fila.dlq, EXCHANGE_DLX, fila.dlq);

    await channel.assertQueue(fila.nome, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGE_DLX,
        'x-dead-letter-routing-key': fila.dlq,
      },
    });

    for (const routingKey of fila.routingKeys) {
      await channel.bindQueue(fila.nome, EXCHANGE_EVENTOS, routingKey);
    }
  }
}
