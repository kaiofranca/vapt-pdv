import { describe, expect, it, vi } from 'vitest';
import amqplib from 'amqplib';
import { buildApp } from '../src/app';
import { carregarEnv } from '../src/config/env';
import { FichasRepositorio } from '../src/modules/fichas/repositorio';
import { FichasServico } from '../src/modules/fichas/servico';
import {
  CanalAmqp,
  declararTopologiaRabbitMQ,
  DEFINICOES_FILAS,
  EXCHANGE_DLX,
  EXCHANGE_EVENTOS,
  FILAS,
  gravarEventoOutbox,
  mensageriaHabilitada,
  MensagemAmqp,
  OutboxPublisher,
  PREFETCH_PADRAO,
  RabbitMQClient,
  registrarConsumidorKds,
} from '../src/shared/messaging';

function criarBancoMemoriaKds(fichasIniciais: any[] = []) {
  const fichas = new Map<number, any>(fichasIniciais.map((f) => [f.id, { ...f }]));
  const outbox = new Map<string, any>();
  const eventosProcessados = new Map<string, any>();
  let proximoFichaId =
    fichasIniciais.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
  let transacoesExecutadas = 0;

  const criarDelegados = (
    estadoFichas: Map<number, any>,
    estadoOutbox: Map<string, any>,
    estadoProcessados: Map<string, any>,
  ) => ({
    $queryRaw: async () => [{ '?column?': 1 }],
    $disconnect: async () => {},
    fichaPreparo: {
      findUnique: async ({ where }: any) => {
        if (where.id !== undefined) {
          const item = estadoFichas.get(where.id);
          return item ? { ...item } : null;
        }
        if (where.itemComandaId !== undefined) {
          for (const item of estadoFichas.values()) {
            if (item.itemComandaId === where.itemComandaId) {
              return { ...item };
            }
          }
        }
        return null;
      },
      create: async ({ data }: any) => {
        for (const item of estadoFichas.values()) {
          if (item.itemComandaId === data.itemComandaId) {
            const err: any = new Error('Unique constraint failed on item_comanda_id');
            err.code = 'P2002';
            throw err;
          }
        }
        const novoId = proximoFichaId++;
        const registro = {
          id: novoId,
          comandaId: data.comandaId,
          itemComandaId: data.itemComandaId,
          mesa: data.mesa,
          garcomId: data.garcomId,
          nomeGarcom: data.nomeGarcom ?? null,
          setor: data.setor,
          produtoId: data.produtoId,
          nomeProduto: data.nomeProduto,
          quantidade: data.quantidade,
          observacao: data.observacao ?? null,
          status: data.status ?? 'recebido',
          recebidoEm: new Date('2026-11-22T20:00:00.000Z'),
          iniciadoEm: null,
          prontoEm: null,
          entregueEm: null,
        };
        estadoFichas.set(novoId, registro);
        return { ...registro };
      },
      update: async ({ where, data }: any) => {
        const atual = estadoFichas.get(where.id);
        if (!atual) {
          throw new Error(`Ficha ${where.id} não encontrada`);
        }
        const atualizado = { ...atual, ...data };
        estadoFichas.set(where.id, atualizado);
        return { ...atualizado };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, item] of estadoFichas.entries()) {
          const casaComanda = where.comandaId ? item.comandaId === where.comandaId : true;
          const casaItem = where.itemComandaId ? item.itemComandaId === where.itemComandaId : true;
          const casaStatus = where.status?.in ? where.status.in.includes(item.status) : true;
          if (casaComanda && casaItem && casaStatus) {
            estadoFichas.set(id, { ...item, ...data });
            count += 1;
          }
        }
        return { count };
      },
    },
    outboxEvento: {
      create: async ({ data }: any) => {
        const registro = {
          id: data.id,
          tipoEvento: data.tipoEvento,
          chaveAgregado: data.chaveAgregado,
          payload: data.payload,
          status: data.status ?? 'PENDENTE',
          tentativas: data.tentativas ?? 0,
          criadoEm: new Date(),
          publicadoEm: null,
        };
        estadoOutbox.set(registro.id, registro);
        return { ...registro };
      },
      findMany: async ({ where, take }: any) => {
        const lista = [...estadoOutbox.values()]
          .filter((item) => (where?.status ? item.status === where.status : true))
          .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
        return lista.slice(0, take ?? 50).map((item) => ({ ...item }));
      },
      update: async ({ where, data }: any) => {
        const atual = estadoOutbox.get(where.id);
        if (!atual) {
          throw new Error(`Outbox ${where.id} não encontrado`);
        }
        const atualizado = { ...atual, ...data };
        estadoOutbox.set(where.id, atualizado);
        return { ...atualizado };
      },
    },
    eventoProcessado: {
      findUnique: async ({ where }: any) => {
        const item = estadoProcessados.get(where.eventoId);
        return item ? { ...item } : null;
      },
      create: async ({ data }: any) => {
        if (estadoProcessados.has(data.eventoId)) {
          const err: any = new Error('Unique constraint failed on evento_id');
          err.code = 'P2002';
          throw err;
        }
        const registro = {
          eventoId: data.eventoId,
          evento: data.evento,
          processadoEm: new Date(),
        };
        estadoProcessados.set(data.eventoId, registro);
        return { ...registro };
      },
    },
  });

  const prisma: any = {
    ...criarDelegados(fichas, outbox, eventosProcessados),
    $transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      transacoesExecutadas += 1;
      const cloneFichas = new Map(
        [...fichas.entries()].map(([k, v]) => [k, { ...v }]),
      );
      const cloneOutbox = new Map(
        [...outbox.entries()].map(([k, v]) => [k, { ...v }]),
      );
      const cloneProcessados = new Map(
        [...eventosProcessados.entries()].map(([k, v]) => [k, { ...v }]),
      );
      const tx = criarDelegados(cloneFichas, cloneOutbox, cloneProcessados);
      const resultado = await fn(tx);

      fichas.clear();
      for (const [k, v] of cloneFichas.entries()) fichas.set(k, v);
      outbox.clear();
      for (const [k, v] of cloneOutbox.entries()) outbox.set(k, v);
      eventosProcessados.clear();
      for (const [k, v] of cloneProcessados.entries()) eventosProcessados.set(k, v);

      return resultado;
    },
  };

  return {
    prisma,
    fichas,
    outbox,
    eventosProcessados,
    getTransacoesExecutadas: () => transacoesExecutadas,
  };
}

function criarCanalMock() {
  const consumidores = new Map<string, (msg: MensagemAmqp | null) => any>();
  const exchangesDeclarados: Array<{ nome: string; tipo: string; opcoes: any }> = [];
  const filasDeclaradas: Array<{ nome: string; opcoes: any }> = [];
  const bindingsDeclarados: Array<{ fila: string; exchange: string; pattern: string }> = [];
  const publicacoes: Array<{ exchange: string; routingKey: string; content: Buffer; options: any }> = [];
  const republicacoesFila: Array<{ fila: string; content: Buffer; options: any }> = [];
  const acks: any[] = [];
  const nacks: Array<{ msg: any; allUpTo?: boolean; requeue?: boolean }> = [];
  const prefetches: number[] = [];

  const canal: CanalAmqp = {
    assertExchange: vi.fn(async (nome: string, tipo: string, opcoes: any) => {
      exchangesDeclarados.push({ nome, tipo, opcoes });
      return { exchange: nome };
    }),
    assertQueue: vi.fn(async (nome: string, opcoes: any) => {
      filasDeclaradas.push({ nome, opcoes });
      return { queue: nome };
    }),
    bindQueue: vi.fn(async (fila: string, exchange: string, pattern: string) => {
      bindingsDeclarados.push({ fila, exchange, pattern });
      return {};
    }),
    publish: vi.fn((exchange: string, routingKey: string, content: Buffer, options: any) => {
      publicacoes.push({ exchange, routingKey, content, options });
      return true;
    }),
    sendToQueue: vi.fn((fila: string, content: Buffer, options: any) => {
      republicacoesFila.push({ fila, content, options });
      return true;
    }),
    prefetch: vi.fn(async (count: number) => {
      prefetches.push(count);
      return {};
    }),
    consume: vi.fn(async (fila: string, onMessage: (msg: MensagemAmqp | null) => void) => {
      consumidores.set(fila, onMessage);
      return { consumerTag: `tag-${fila}` };
    }),
    ack: vi.fn((msg: any) => {
      acks.push(msg);
    }),
    nack: vi.fn((msg: any, allUpTo?: boolean, requeue?: boolean) => {
      nacks.push({ msg, allUpTo, requeue });
    }),
    waitForConfirms: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    on: vi.fn(),
  };

  const entregarMensagem = async (
    fila: string,
    conteudo: string | Record<string, unknown>,
    overrides: Partial<MensagemAmqp> = {},
  ) => {
    const handler = consumidores.get(fila);
    if (!handler) {
      throw new Error(`Nenhum consumidor registrado para a fila ${fila}`);
    }
    const raw = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
    const msg: MensagemAmqp = {
      content: Buffer.from(raw, 'utf-8'),
      fields: {
        routingKey: overrides.fields?.routingKey ?? 'item.lancado',
        deliveryTag: overrides.fields?.deliveryTag ?? 1,
        redelivered: overrides.fields?.redelivered ?? false,
        exchange: overrides.fields?.exchange ?? EXCHANGE_EVENTOS,
      },
      properties: {
        messageId: overrides.properties?.messageId,
        contentType: overrides.properties?.contentType ?? 'application/json',
        headers: overrides.properties?.headers ?? {},
        ...overrides.properties,
      },
    };
    await handler(msg);
    return msg;
  };

  return {
    canal,
    exchangesDeclarados,
    filasDeclaradas,
    bindingsDeclarados,
    publicacoes,
    republicacoesFila,
    acks,
    nacks,
    prefetches,
    entregarMensagem,
  };
}

describe('Mensageria RabbitMQ, Transactional Outbox e Consumidor Idempotente (kds-service)', () => {
  it('deve validar mensageriaHabilitada e carregamento de RABBITMQ_URL em carregarEnv', () => {
    expect(mensageriaHabilitada(undefined)).toBe(false);
    expect(mensageriaHabilitada('')).toBe(false);
    expect(mensageriaHabilitada('   ')).toBe(false);
    expect(mensageriaHabilitada('disabled')).toBe(false);
    expect(mensageriaHabilitada('DISABLED')).toBe(false);
    expect(mensageriaHabilitada('amqp://vaptpdv:vaptpdv_secret@localhost:5672')).toBe(true);

    const anterior = process.env.RABBITMQ_URL;
    try {
      process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
      expect(carregarEnv().RABBITMQ_URL).toBe('amqp://guest:guest@localhost:5672');
      process.env.RABBITMQ_URL = '   ';
      expect(carregarEnv().RABBITMQ_URL).toBeUndefined();
    } finally {
      if (anterior === undefined) {
        delete process.env.RABBITMQ_URL;
      } else {
        process.env.RABBITMQ_URL = anterior;
      }
    }
  });

  it('deve declarar topologia completa no RabbitMQ com exchanges, 5 filas duráveis, 5 DLQs e bindings', async () => {
    const mock = criarCanalMock();
    await declararTopologiaRabbitMQ(mock.canal);

    expect(mock.exchangesDeclarados).toEqual([
      { nome: EXCHANGE_EVENTOS, tipo: 'topic', opcoes: { durable: true, autoDelete: false } },
      { nome: EXCHANGE_DLX, tipo: 'direct', opcoes: { durable: true, autoDelete: false } },
    ]);

    for (const def of DEFINICOES_FILAS) {
      expect(mock.filasDeclaradas).toContainEqual({
        nome: def.dlq,
        opcoes: { durable: true },
      });
      expect(mock.filasDeclaradas).toContainEqual({
        nome: def.nome,
        opcoes: {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': EXCHANGE_DLX,
            'x-dead-letter-routing-key': def.dlq,
          },
        },
      });
      expect(mock.bindingsDeclarados).toContainEqual({
        fila: def.dlq,
        exchange: EXCHANGE_DLX,
        pattern: def.dlq,
      });
      for (const rk of def.routingKeys) {
        expect(mock.bindingsDeclarados).toContainEqual({
          fila: def.nome,
          exchange: EXCHANGE_EVENTOS,
          pattern: rk,
        });
      }
    }
  });

  it('PATCH /kds/fichas/:id/status para "pronto" grava evento item.pronto em outbox_eventos na mesma transação e OutboxPublisher publica e marca PUBLICADO', async () => {
    const db = criarBancoMemoriaKds([
      {
        id: 19,
        comandaId: 12,
        itemComandaId: 45,
        mesa: 6,
        garcomId: 1,
        nomeGarcom: 'Lucas',
        setor: 'cozinha',
        produtoId: 3,
        nomeProduto: 'Porção de Batata com Cheddar',
        quantidade: 1,
        observacao: 'Sem cebola',
        status: 'em_preparo',
        recebidoEm: new Date('2026-11-22T20:00:00.000Z'),
        iniciadoEm: new Date('2026-11-22T20:02:00.000Z'),
        prontoEm: null,
        entregueEm: null,
      },
    ]);

    const canalMock = criarCanalMock();
    const rabbitMock = {
      estaConectado: () => true,
      publicarEvento: vi.fn(async (tipoEvento: string, payload: unknown, messageId: string) => {
        canalMock.canal.publish(
          EXCHANGE_EVENTOS,
          tipoEvento,
          Buffer.from(JSON.stringify(payload), 'utf-8'),
          {
            persistent: true,
            deliveryMode: 2,
            messageId,
            contentType: 'application/json',
            timestamp: Date.now(),
          },
        );
        await canalMock.canal.waitForConfirms?.();
      }),
    };

    const outboxPublisher = new OutboxPublisher(db.prisma, rabbitMock);
    const notificarSpy = vi.spyOn(outboxPublisher, 'notificarNovoEvento');

    const app = await buildApp({
      prisma: db.prisma,
      nodeEnv: 'test',
      logLevel: 'silent',
      outboxPublisher,
    });

    const resposta = await app.inject({
      method: 'PATCH',
      url: '/kds/fichas/19/status',
      payload: { status: 'pronto' },
    });

    expect(resposta.statusCode).toBe(200);
    const corpo = JSON.parse(resposta.body);
    expect(corpo.status).toBe('pronto');
    expect(corpo.pronto_em).toBeTruthy();

    expect(db.getTransacoesExecutadas()).toBe(1);
    expect(notificarSpy).toHaveBeenCalledTimes(1);
    expect(db.outbox.size).toBe(1);

    const [registroOutbox] = [...db.outbox.values()];
    expect(registroOutbox.tipoEvento).toBe('item.pronto');
    expect(registroOutbox.chaveAgregado).toBe('ficha:19');
    expect(registroOutbox.status).toBe('PENDENTE');
    expect(registroOutbox.tentativas).toBe(0);
    expect(registroOutbox.publicadoEm).toBeNull();
    expect(registroOutbox.payload).toMatchObject({
      evento_id: registroOutbox.id,
      evento: 'item.pronto',
      versao: 1,
      ficha_id: 19,
      comanda_id: 12,
      item_comanda_id: 45,
      produto_id: 3,
      nome_produto: 'Porção de Batata com Cheddar',
      mesa: 6,
      setor: 'cozinha',
      status_preparo: 'pronto',
      pronto_em: corpo.pronto_em,
      ocorrido_em: corpo.pronto_em,
    });

    const publicados = await outboxPublisher.processarLote();
    expect(publicados).toBe(1);
    expect(rabbitMock.publicarEvento).toHaveBeenCalledWith(
      'item.pronto',
      registroOutbox.payload,
      registroOutbox.id,
    );
    expect(canalMock.publicacoes).toHaveLength(1);
    expect(canalMock.publicacoes[0].exchange).toBe('vaptpdv.eventos');
    expect(canalMock.publicacoes[0].routingKey).toBe('item.pronto');
    expect(canalMock.publicacoes[0].options).toMatchObject({
      persistent: true,
      deliveryMode: 2,
      messageId: registroOutbox.id,
      contentType: 'application/json',
    });

    const atualizadoOutbox = db.outbox.get(registroOutbox.id);
    expect(atualizadoOutbox.status).toBe('PUBLICADO');
    expect(atualizadoOutbox.publicadoEm).toBeInstanceOf(Date);

    await app.close();
  });

  it('deve incrementar tentativas e manter status PENDENTE quando publicação no broker falha', async () => {
    const db = criarBancoMemoriaKds([]);
    await gravarEventoOutbox(db.prisma, {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      tipoEvento: 'item.pronto',
      chaveAgregado: 'ficha:19',
      payload: { evento_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', evento: 'item.pronto' },
    });

    const rabbitFalho = {
      estaConectado: () => true,
      publicarEvento: vi.fn(async () => {
        throw new Error('Broker unreachable');
      }),
    };

    const publisher = new OutboxPublisher(db.prisma, rabbitFalho);
    const publicados = await publisher.processarLote();

    expect(publicados).toBe(0);
    const reg = db.outbox.get('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(reg.status).toBe('PENDENTE');
    expect(reg.tentativas).toBe(1);
    expect(reg.publicadoEm).toBeNull();
  });

  it('gravarEventoOutbox deve retornar silenciosamente em mocks legados sem outboxEvento', async () => {
    const mockLegado = { $queryRaw: async () => [], $disconnect: async () => {} };
    const resultado = await gravarEventoOutbox(mockLegado, {
      tipoEvento: 'item.pronto',
      chaveAgregado: 'ficha:1',
      payload: { evento: 'item.pronto' },
    });
    expect(resultado).toBeNull();
  });

  it('consumidor kds.item.lancado cria ficha, grava eventos_processados, configura prefetch(10) e executa ack manual pós-commit', async () => {
    const db = criarBancoMemoriaKds([]);
    const canalMock = criarCanalMock();
    const repositorio = new FichasRepositorio(db.prisma);
    const fichasServico = new FichasServico(repositorio);

    await registrarConsumidorKds(canalMock.canal, db.prisma, fichasServico);

    expect(canalMock.prefetches).toEqual([PREFETCH_PADRAO]);
    expect(canalMock.canal.consume).toHaveBeenCalledWith(
      FILAS.KDS_ITEM_LANCADO,
      expect.any(Function),
      { noAck: false },
    );

    const eventoId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const msg = await canalMock.entregarMensagem(
      FILAS.KDS_ITEM_LANCADO,
      {
        evento_id: eventoId,
        evento: 'item.lancado',
        versao: 1,
        ocorrido_em: '2026-11-22T20:00:00.000Z',
        comanda_id: 12,
        item_comanda_id: 45,
        produto_id: 3,
        mesa: 6,
        garcom_id: 1,
        nome_garcom: 'Lucas',
        nome_produto: 'Porção de Batata com Cheddar',
        categoria: 'Porções',
        setor: 'cozinha',
        preco_copiado: '34.90',
        quantidade: 1,
        observacao: 'Sem cebola',
      },
      { fields: { routingKey: 'item.lancado' } },
    );

    expect(db.fichas.size).toBe(1);
    const [fichaCriada] = [...db.fichas.values()];
    expect(fichaCriada).toMatchObject({
      comandaId: 12,
      itemComandaId: 45,
      mesa: 6,
      garcomId: 1,
      nomeGarcom: 'Lucas',
      setor: 'cozinha',
      produtoId: 3,
      nomeProduto: 'Porção de Batata com Cheddar',
      quantidade: 1,
      observacao: 'Sem cebola',
      status: 'recebido',
    });

    expect(db.eventosProcessados.get(eventoId)).toMatchObject({
      eventoId,
      evento: 'item.lancado',
    });
    expect(canalMock.acks).toEqual([msg]);
    expect(canalMock.nacks).toHaveLength(0);
  });

  it('consumidor kds.item.lancado ignora reentrega duplicada do mesmo evento_id sem duplicar ficha e executa ack', async () => {
    const db = criarBancoMemoriaKds([]);
    const canalMock = criarCanalMock();
    const repositorio = new FichasRepositorio(db.prisma);
    const fichasServico = new FichasServico(repositorio);
    const registrarSpy = vi.spyOn(fichasServico, 'registrarFicha');

    await registrarConsumidorKds(canalMock.canal, db.prisma, fichasServico);

    const payload = {
      evento_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      evento: 'item.lancado',
      versao: 1,
      ocorrido_em: '2026-11-22T20:00:00.000Z',
      comanda_id: 12,
      item_comanda_id: 45,
      produto_id: 3,
      mesa: 6,
      garcom_id: 1,
      nome_garcom: 'Lucas',
      nome_produto: 'Porção de Batata com Cheddar',
      setor: 'cozinha',
      quantidade: 1,
      observacao: 'Sem cebola',
    };

    const msg1 = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, payload);
    const msg2 = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, payload);

    expect(db.fichas.size).toBe(1);
    expect(registrarSpy).toHaveBeenCalledTimes(1);
    expect(canalMock.acks).toEqual([msg1, msg2]);
    expect(canalMock.nacks).toHaveLength(0);
  });

  it('consumidor kds.item.lancado cancela fichas ativas ao receber comanda.cancelada', async () => {
    const db = criarBancoMemoriaKds([
      {
        id: 1,
        comandaId: 15,
        itemComandaId: 201,
        mesa: 9,
        garcomId: 1,
        nomeGarcom: 'Lucas',
        setor: 'cozinha',
        produtoId: 5,
        nomeProduto: 'Filé à Parmegiana',
        quantidade: 1,
        observacao: null,
        status: 'recebido',
        recebidoEm: new Date(),
        iniciadoEm: null,
        prontoEm: null,
        entregueEm: null,
      },
      {
        id: 2,
        comandaId: 15,
        itemComandaId: 202,
        mesa: 9,
        garcomId: 1,
        nomeGarcom: 'Lucas',
        setor: 'bar',
        produtoId: 8,
        nomeProduto: 'Suco de Laranja',
        quantidade: 2,
        observacao: null,
        status: 'entregue',
        recebidoEm: new Date(),
        iniciadoEm: new Date(),
        prontoEm: new Date(),
        entregueEm: new Date(),
      },
    ]);

    const canalMock = criarCanalMock();
    const repositorio = new FichasRepositorio(db.prisma);
    const fichasServico = new FichasServico(repositorio);

    await registrarConsumidorKds(canalMock.canal, db.prisma, fichasServico);

    const eventoId = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const msg = await canalMock.entregarMensagem(
      FILAS.KDS_ITEM_LANCADO,
      {
        evento_id: eventoId,
        evento: 'comanda.cancelada',
        versao: 1,
        ocorrido_em: '2026-11-22T20:15:00.000Z',
        comanda_id: 15,
        mesa: 9,
        motivo_cancelamento: 'Cliente desistiu antes do preparo',
      },
      { fields: { routingKey: 'comanda.cancelada' } },
    );

    expect(db.fichas.get(1).status).toBe('cancelado');
    expect(db.fichas.get(2).status).toBe('entregue');
    expect(db.eventosProcessados.get(eventoId)).toMatchObject({
      eventoId,
      evento: 'comanda.cancelada',
    });
    expect(canalMock.acks).toEqual([msg]);
    expect(canalMock.nacks).toHaveLength(0);
  });

  it('consumidor realiza retry com x-retry-count 1 e 2, e envia para .dlq na 3ª falha via nack(msg, false, false)', async () => {
    const db = criarBancoMemoriaKds([]);
    const canalMock = criarCanalMock();
    const servicoComErro = {
      registrarFicha: vi.fn(async () => {
        throw new Error('Falha transitória ao persistir ficha');
      }),
      cancelarFichas: vi.fn(async () => ({ canceladas: 0 })),
    };

    await registrarConsumidorKds(canalMock.canal, db.prisma, servicoComErro);

    const payload = {
      evento_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      evento: 'item.lancado',
      comanda_id: 12,
      item_comanda_id: 45,
      produto_id: 3,
      mesa: 6,
      garcom_id: 1,
      nome_produto: 'Porção de Batata',
      setor: 'cozinha',
      quantidade: 1,
    };

    // 1ª entrega (x-retry-count ausente => 0) -> republica com x-retry-count: 1 e ack na original
    const msg1 = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, payload);
    expect(canalMock.republicacoesFila).toHaveLength(1);
    expect(canalMock.republicacoesFila[0].fila).toBe(FILAS.KDS_ITEM_LANCADO);
    expect(canalMock.republicacoesFila[0].options.headers['x-retry-count']).toBe(1);
    expect(canalMock.acks).toEqual([msg1]);
    expect(canalMock.nacks).toHaveLength(0);

    // 2ª entrega (x-retry-count: 1) -> republica com x-retry-count: 2 e ack na original
    const msg2 = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, payload, {
      properties: { headers: { 'x-retry-count': 1 } },
    });
    expect(canalMock.republicacoesFila).toHaveLength(2);
    expect(canalMock.republicacoesFila[1].options.headers['x-retry-count']).toBe(2);
    expect(canalMock.acks).toEqual([msg1, msg2]);
    expect(canalMock.nacks).toHaveLength(0);

    // 3ª entrega (x-retry-count: 2 => tentativa 3 >= MAX_TENTATIVAS_CONSUMO) -> nack(msg, false, false) -> .dlq
    const msg3 = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, payload, {
      properties: { headers: { 'x-retry-count': 2 } },
    });
    expect(canalMock.republicacoesFila).toHaveLength(2);
    expect(canalMock.acks).toEqual([msg1, msg2]);
    expect(canalMock.nacks).toEqual([{ msg: msg3, allUpTo: false, requeue: false }]);
  });

  it('consumidor envia JSON corrompido ou mensagem sem ID direto para .dlq via nack(msg, false, false)', async () => {
    const db = criarBancoMemoriaKds([]);
    const canalMock = criarCanalMock();
    const repositorio = new FichasRepositorio(db.prisma);
    const fichasServico = new FichasServico(repositorio);

    await registrarConsumidorKds(canalMock.canal, db.prisma, fichasServico);

    const msgCorrompida = await canalMock.entregarMensagem(
      FILAS.KDS_ITEM_LANCADO,
      '{json-invalido',
    );
    const msgSemId = await canalMock.entregarMensagem(FILAS.KDS_ITEM_LANCADO, {
      evento: 'item.lancado',
      comanda_id: 1,
    });

    expect(canalMock.republicacoesFila).toHaveLength(0);
    expect(canalMock.acks).toHaveLength(0);
    expect(canalMock.nacks).toEqual([
      { msg: msgCorrompida, allUpTo: false, requeue: false },
      { msg: msgSemId, allUpTo: false, requeue: false },
    ]);
  });

  it('RabbitMQClient conecta, declara topologia, executa callbacks, publica com confirm e fecha graciosamente', async () => {
    const canalMock = criarCanalMock();
    const conexaoFake: any = {
      createConfirmChannel: vi.fn(async () => canalMock.canal),
      on: vi.fn(),
      close: vi.fn(async () => {}),
    };

    const connectSpy = vi.spyOn(amqplib, 'connect').mockResolvedValue(conexaoFake);
    try {
      const client = new RabbitMQClient('amqp://vaptpdv:vaptpdv_secret@localhost:5672');
      const callback = vi.fn();
      client.registrarCallbackConexao(callback);

      await client.conectar();
      expect(client.estaConectado()).toBe(true);
      expect(client.obterCanal()).toBe(canalMock.canal);
      expect(callback).toHaveBeenCalledWith(canalMock.canal);
      expect(canalMock.exchangesDeclarados.length).toBe(2);

      await client.publicarEvento('item.pronto', { ok: true }, 'msg-123');
      expect(canalMock.publicacoes).toHaveLength(1);
      expect(canalMock.publicacoes[0].exchange).toBe(EXCHANGE_EVENTOS);
      expect(canalMock.publicacoes[0].routingKey).toBe('item.pronto');
      expect(canalMock.publicacoes[0].options).toMatchObject({
        persistent: true,
        deliveryMode: 2,
        messageId: 'msg-123',
        contentType: 'application/json',
      });
      expect(canalMock.canal.waitForConfirms).toHaveBeenCalled();

      await client.fechar();
      expect(client.estaConectado()).toBe(false);
      expect(client.obterCanal()).toBeNull();
    } finally {
      connectSpy.mockRestore();
    }
  });
});
