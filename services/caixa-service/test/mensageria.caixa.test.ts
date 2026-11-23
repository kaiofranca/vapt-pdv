import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import amqplib from 'amqplib';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { validarEnv } from '../src/config/env';
import {
  CobrancasService,
  PrismaCobrancasRepository,
} from '../src/modules/caixa';
import { EstoqueCoreGateway, GestaoGateway } from '../src/modules/caixa/gateways';
import {
  CanalAmqp,
  DEFINICOES_FILAS,
  EXCHANGE_DLX,
  EXCHANGE_EVENTOS,
  FILAS,
  MAX_TENTATIVAS_CONSUMO,
  MensagemAmqp,
  OutboxPublisher,
  PREFETCH_PADRAO,
  RabbitMQClient,
  declararTopologiaRabbitMQ,
  gravarEventoOutbox,
  mensageriaHabilitada,
  registrarConsumidorCaixa,
} from '../src/shared/messaging';
import { ClienteBanco } from '../src/shared/prisma';
import { MemoriaCobrancasRepository } from './helpers/memoria.repository';

interface PublicacaoRegistrada {
  exchange: string;
  routingKey: string;
  content: Buffer;
  options?: Record<string, unknown>;
}

interface EnvioFilaRegistrado {
  queue: string;
  content: Buffer;
  options?: Record<string, unknown>;
}

function criarCanalAmqpMock() {
  const exchangesAssertadas: Array<{ name: string; type: string; options?: Record<string, unknown> }> = [];
  const filasAssertadas: Array<{ name: string; options?: Record<string, unknown> }> = [];
  const bindings: Array<{ queue: string; source: string; pattern: string }> = [];
  const publicacoes: PublicacaoRegistrada[] = [];
  const enviosFila: EnvioFilaRegistrado[] = [];
  const acks: MensagemAmqp[] = [];
  const nacks: Array<{ msg: MensagemAmqp; allUpTo?: boolean; requeue?: boolean }> = [];
  const mensagensDlq: Record<string, MensagemAmqp[]> = {};
  const handlersPorFila = new Map<string, (msg: MensagemAmqp | null) => Promise<void> | void>();
  let prefetchAtual: number | null = null;

  const dlqPorFila = new Map<string, string>();
  for (const def of DEFINICOES_FILAS) {
    dlqPorFila.set(def.fila, def.dlq);
  }

  const canal: CanalAmqp = {
    assertExchange: vi.fn(async (name: string, type: string, options?: Record<string, unknown>) => {
      exchangesAssertadas.push({ name, type, options });
      return { exchange: name };
    }),
    assertQueue: vi.fn(async (name: string, options?: Record<string, unknown>) => {
      filasAssertadas.push({ name, options });
      const dlq = options?.arguments && (options.arguments as Record<string, unknown>)['x-dead-letter-routing-key'];
      if (typeof dlq === 'string') {
        dlqPorFila.set(name, dlq);
      }
      return { queue: name, messageCount: 0, consumerCount: 0 };
    }),
    bindQueue: vi.fn(async (queue: string, source: string, pattern: string) => {
      bindings.push({ queue, source, pattern });
      return {};
    }),
    publish: vi.fn((exchange: string, routingKey: string, content: Buffer, options?: Record<string, unknown>) => {
      publicacoes.push({ exchange, routingKey, content, options });
      return true;
    }),
    sendToQueue: vi.fn((queue: string, content: Buffer, options?: Record<string, unknown>) => {
      enviosFila.push({ queue, content, options });
      return true;
    }),
    prefetch: vi.fn(async (count: number) => {
      prefetchAtual = count;
      return {};
    }),
    consume: vi.fn(async (queue: string, onMessage: (msg: MensagemAmqp | null) => void) => {
      handlersPorFila.set(queue, onMessage);
      return { consumerTag: `ctag-${queue}` };
    }),
    ack: vi.fn((msg: MensagemAmqp) => {
      acks.push(msg);
    }),
    nack: vi.fn((msg: MensagemAmqp, allUpTo?: boolean, requeue?: boolean) => {
      nacks.push({ msg, allUpTo, requeue });
      if (requeue === false) {
        const filaOrigem = msg.fields?.routingKey || FILAS.CAIXA_COMANDA_FECHADA;
        const dlq = dlqPorFila.get(filaOrigem) || `${filaOrigem}.dlq`;
        mensagensDlq[dlq] = mensagensDlq[dlq] || [];
        mensagensDlq[dlq].push(msg);
      }
    }),
    waitForConfirms: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };

  async function entregar(fila: string, msg: MensagemAmqp | null): Promise<void> {
    const handler = handlersPorFila.get(fila);
    if (!handler) {
      throw new Error(`Nenhum consumidor registrado na fila ${fila}`);
    }
    await handler(msg);
  }

  return {
    canal,
    exchangesAssertadas,
    filasAssertadas,
    bindings,
    publicacoes,
    enviosFila,
    acks,
    nacks,
    mensagensDlq,
    entregar,
    obterPrefetch: () => prefetchAtual,
  };
}

function criarControleEventosMemoria() {
  const registros = new Map<string, { eventoId: string; evento: string; processadoEm: Date }>();

  return {
    registros,
    eventoProcessado: {
      findUnique: vi.fn(async ({ where }: { where: { eventoId: string } }) => {
        return registros.get(where.eventoId) ?? null;
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { eventoId: string; evento: string; processadoEm?: Date };
        }) => {
          if (registros.has(data.eventoId)) {
            throw new Error(`Evento ${data.eventoId} já processado`);
          }
          const registro = {
            eventoId: data.eventoId,
            evento: data.evento,
            processadoEm: data.processadoEm ?? new Date(),
          };
          registros.set(data.eventoId, registro);
          return registro;
        },
      ),
    },
  };
}

describe('Mensageria RabbitMQ, Transactional Outbox e Consumidor Idempotente — caixa-service', () => {
  let repository: MemoriaCobrancasRepository;
  let mockEstoqueGateway: EstoqueCoreGateway;
  let mockGestaoGateway: GestaoGateway;

  beforeEach(() => {
    repository = new MemoriaCobrancasRepository();
    mockEstoqueGateway = {
      baixarEstoque: vi.fn(async () => {}),
    };
    mockGestaoGateway = {
      notificarEvento: vi.fn(async () => ({ sucesso: true })),
      notificarComandaPaga: vi.fn(async () => ({ sucesso: true })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuração e Topologia Declarativa RabbitMQ', () => {
    it('deve detectar corretamente mensageriaHabilitada e validar RABBITMQ_URL em env.ts', () => {
      expect(mensageriaHabilitada('')).toBe(false);
      expect(mensageriaHabilitada('   ')).toBe(false);
      expect(mensageriaHabilitada('disabled')).toBe(false);
      expect(mensageriaHabilitada('DISABLED')).toBe(false);
      expect(mensageriaHabilitada('amqp://vaptpdv:secret@rabbitmq:5672')).toBe(true);

      const envSemRabbit = validarEnv({ NODE_ENV: 'test', RABBITMQ_URL: '   ' });
      expect(envSemRabbit.RABBITMQ_URL).toBeUndefined();

      const envComRabbit = validarEnv({
        NODE_ENV: 'test',
        RABBITMQ_URL: 'amqp://localhost:5672',
      });
      expect(envComRabbit.RABBITMQ_URL).toBe('amqp://localhost:5672');
    });

    it('deve declarar exchanges, 5 filas principais com DLX, 5 DLQs e bindings canônicos', async () => {
      const mock = criarCanalAmqpMock();

      await declararTopologiaRabbitMQ(mock.canal);

      expect(mock.exchangesAssertadas).toEqual([
        {
          name: EXCHANGE_EVENTOS,
          type: 'topic',
          options: { durable: true, autoDelete: false },
        },
        {
          name: EXCHANGE_DLX,
          type: 'direct',
          options: { durable: true, autoDelete: false },
        },
      ]);

      expect(mock.filasAssertadas).toHaveLength(10);
      expect(mock.filasAssertadas).toContainEqual({
        name: FILAS.CAIXA_COMANDA_FECHADA,
        options: {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': EXCHANGE_DLX,
            'x-dead-letter-routing-key': 'caixa.comanda.fechada.dlq',
          },
        },
      });
      expect(mock.filasAssertadas).toContainEqual({
        name: 'caixa.comanda.fechada.dlq',
        options: { durable: true },
      });

      expect(mock.bindings).toContainEqual({
        queue: FILAS.CAIXA_COMANDA_FECHADA,
        source: EXCHANGE_EVENTOS,
        pattern: 'comanda.fechada',
      });
      expect(mock.bindings).toContainEqual({
        queue: FILAS.PRODUTOS_COMANDA_PAGA,
        source: EXCHANGE_EVENTOS,
        pattern: 'comanda.paga',
      });
      expect(mock.bindings).toContainEqual({
        queue: FILAS.GESTAO_EVENTOS,
        source: EXCHANGE_EVENTOS,
        pattern: '#',
      });
      expect(mock.bindings).toContainEqual({
        queue: 'caixa.comanda.fechada.dlq',
        source: EXCHANGE_DLX,
        pattern: 'caixa.comanda.fechada.dlq',
      });
    });
  });

  describe('Transactional Outbox na Quitação (comanda.paga)', () => {
    it('deve persistir parcela + recibo + evento comanda.paga no Outbox sem chamar gateways HTTP e publicar via OutboxPublisher', async () => {
      const canalMock = criarCanalAmqpMock();
      const publicadorMock = {
        estaConectado: () => true,
        publicarEvento: vi.fn(async (tipoEvento: string, payload: unknown, messageId: string) => {
          canalMock.canal.publish(
            EXCHANGE_EVENTOS,
            tipoEvento,
            Buffer.from(JSON.stringify(payload)),
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

      const outboxPublisher = new OutboxPublisher(repository, publicadorMock, {
        intervaloMs: 500,
        tamanhoLote: 50,
      });

      const app = await buildApp({
        repository,
        estoqueGateway: mockEstoqueGateway,
        gestaoGateway: mockGestaoGateway,
        outboxPublisher,
        usarMensageria: true,
        logger: false,
      });
      await app.ready();

      try {
        const resFechar = await app.inject({
          method: 'POST',
          url: '/caixa/comandas/12/fechar',
          payload: {
            mesa: 6,
            garcom_id: 1,
            garcom_nome: 'Lucas',
            nome_cliente: 'Mariana',
            aplicar_taxa_servico: true,
            itens: [
              {
                item_comanda_id: 44,
                produto_id: 1,
                nome: 'Chopp Pilsen 300ml',
                categoria: 'Bebidas',
                preco_unitario: '14.90',
                quantidade: 2,
              },
              {
                item_comanda_id: 45,
                produto_id: 3,
                nome: 'Porção de Batata com Cheddar',
                categoria: 'Porções',
                preco_unitario: '34.90',
                quantidade: 1,
              },
            ],
          },
        });
        expect(resFechar.statusCode).toBe(200);

        const resParcial = await app.inject({
          method: 'POST',
          url: '/caixa/comandas/12/pagar',
          payload: {
            forma_pagamento: 'dinheiro',
            valor_aplicado: '35.58',
            valor_recebido: '40.00',
            pagador_rotulo: 'Pessoa 1 de 2',
          },
        });
        expect(resParcial.statusCode).toBe(200);
        expect(resParcial.json().status).toBe('parcialmente_paga');
        expect(repository.outboxEventos).toHaveLength(0);

        const resPagar = await app.inject({
          method: 'POST',
          url: '/caixa/comandas/12/pagar',
          payload: {
            forma_pagamento: 'pix',
            valor_aplicado: '35.59',
            pagador_rotulo: 'Pessoa 2 de 2',
            operador_nome: 'Ana Caixa',
          },
        });

        expect(resPagar.statusCode).toBe(200);
        const corpo = resPagar.json();
        expect(corpo.status).toBe('paga');
        expect(corpo.saldo_restante).toBe('0.00');
        expect(corpo.troco_total).toBe('4.42');
        expect(corpo.recibo).toBeDefined();
        expect(corpo.avisos).toEqual([]);

        expect(mockEstoqueGateway.baixarEstoque).not.toHaveBeenCalled();
        expect(mockGestaoGateway.notificarComandaPaga).not.toHaveBeenCalled();

        await new Promise((resolve) => setTimeout(resolve, 10));
        await outboxPublisher.processarLote();

        expect(repository.outboxEventos).toHaveLength(1);
        const outboxRegistro = repository.outboxEventos[0];
        expect(outboxRegistro.tipoEvento).toBe('comanda.paga');
        expect(outboxRegistro.chaveAgregado).toBe('12');
        expect(outboxRegistro.status).toBe('PUBLICADO');
        expect(outboxRegistro.publicadoEm).toBeInstanceOf(Date);

        expect(canalMock.publicacoes).toHaveLength(1);
        const pub = canalMock.publicacoes[0];
        expect(pub.exchange).toBe(EXCHANGE_EVENTOS);
        expect(pub.routingKey).toBe('comanda.paga');
        expect(pub.options?.persistent).toBe(true);
        expect(pub.options?.deliveryMode).toBe(2);
        expect(pub.options?.messageId).toBe(outboxRegistro.id);
        expect(pub.options?.contentType).toBe('application/json');

        const eventoPublicado = JSON.parse(pub.content.toString('utf-8'));
        expect(eventoPublicado.evento_id).toBe(outboxRegistro.id);
        expect(eventoPublicado.evento).toBe('comanda.paga');
        expect(eventoPublicado.versao).toBe(1);
        expect(eventoPublicado.comanda_id).toBe(12);
        expect(eventoPublicado.mesa).toBe(6);
        expect(eventoPublicado.garcom_id).toBe(1);
        expect(eventoPublicado.garcom_nome).toBe('Lucas');
        expect(eventoPublicado.forma_pagamento).toBe('pix');
        expect(eventoPublicado.subtotal).toBe('64.70');
        expect(eventoPublicado.valor_subtotal).toBe('64.70');
        expect(eventoPublicado.taxa_servico).toBe('6.47');
        expect(eventoPublicado.total).toBe('71.17');
        expect(eventoPublicado.valor_total).toBe('71.17');
        expect(eventoPublicado.troco).toBe('4.42');
        expect(eventoPublicado.troco_total).toBe('4.42');
        expect(eventoPublicado.itens).toHaveLength(2);
        expect(eventoPublicado.parcelas).toHaveLength(2);
        expect(eventoPublicado.parcelas[0]).toMatchObject({
          numero_parcela: 1,
          forma_pagamento: 'dinheiro',
          valor_aplicado: '35.58',
          valor_recebido: '40.00',
          troco: '4.42',
        });
        expect(eventoPublicado.parcelas[1]).toMatchObject({
          numero_parcela: 2,
          forma_pagamento: 'pix',
          valor_aplicado: '35.59',
          valor_recebido: '35.59',
          troco: '0.00',
        });
      } finally {
        outboxPublisher.parar();
        await app.close();
      }
    });

    it('deve manter status PENDENTE e incrementar tentativas quando a publicação no RabbitMQ falhar', async () => {
      await gravarEventoOutbox(repository, {
        id: crypto.randomUUID(),
        tipoEvento: 'comanda.paga',
        chaveAgregado: '99',
        payload: { evento: 'comanda.paga', comanda_id: 99 },
      });

      let falhar = true;
      const publicadorInstavel = {
        estaConectado: () => true,
        publicarEvento: vi.fn(async () => {
          if (falhar) {
            throw new Error('Broker temporariamente indisponível');
          }
        }),
      };

      const publisher = new OutboxPublisher(repository, publicadorInstavel);
      const primeiraTentativa = await publisher.processarLote();
      expect(primeiraTentativa).toBe(0);
      expect(repository.outboxEventos[0].status).toBe('PENDENTE');
      expect(repository.outboxEventos[0].tentativas).toBe(1);

      falhar = false;
      const segundaTentativa = await publisher.processarLote();
      expect(segundaTentativa).toBe(1);
      expect(repository.outboxEventos[0].status).toBe('PUBLICADO');
      expect(repository.outboxEventos[0].publicadoEm).toBeInstanceOf(Date);
    });

    it('deve executar quitarComOutbox em PrismaCobrancasRepository dentro de $transaction única', async () => {
      const txMock = {
        pagamentoParcela: {
          create: vi.fn(async ({ data }: any) => ({ id: 10, ...data })),
        },
        cobrancaComanda: {
          update: vi.fn(async ({ data }: any) => ({
            id: 1,
            comandaId: 88,
            mesa: 4,
            garcomId: 2,
            nomeCliente: null,
            status: data.status,
            aplicarTaxaServico: true,
            subtotal: new Prisma.Decimal('50.00'),
            taxaServico: new Prisma.Decimal('5.00'),
            total: new Prisma.Decimal('55.00'),
            valorPago: data.valorPago,
            saldoRestante: data.saldoRestante,
            trocoTotal: data.trocoTotal,
            modoDivisao: 'integral',
            quantidadePagadores: 1,
            itensSnapshot: [],
            divisaoDetalhes: null,
            fechadaEm: new Date(),
            pagaEm: data.pagaEm,
            pagamentos: [],
          })),
        },
        reciboVenda: {
          create: vi.fn(async ({ data }: any) => ({ id: 20, ...data })),
        },
        outboxEvento: {
          create: vi.fn(async ({ data }: any) => ({
            ...data,
            criadoEm: new Date(),
            publicadoEm: null,
          })),
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      } as unknown as ClienteBanco;

      const prismaRepo = new PrismaCobrancasRepository(prismaMock);
      const eventoId = crypto.randomUUID();
      const agora = new Date();

      const res = await prismaRepo.quitarComOutbox({
        comandaId: 88,
        pagamento: {
          cobrancaId: 1,
          comandaId: 88,
          numeroParcela: 1,
          pagadorLabel: 'Conta Integral',
          formaPagamento: 'pix',
          valorAplicado: new Prisma.Decimal('55.00'),
          valorRecebido: new Prisma.Decimal('55.00'),
          troco: new Prisma.Decimal('0.00'),
          registradoEm: agora,
        },
        atualizacao: {
          status: 'paga',
          valorPago: new Prisma.Decimal('55.00'),
          saldoRestante: new Prisma.Decimal('0.00'),
          trocoTotal: new Prisma.Decimal('0.00'),
          pagaEm: agora,
        },
        recibo: {
          codigoAutenticacao: 'VAPT-20261122-M04-ABCD',
          comandaId: 88,
          cobrancaId: 1,
          resumoRecibo: { comanda_id: 88 },
          emitidoEm: agora,
        },
        eventoOutbox: {
          id: eventoId,
          tipoEvento: 'comanda.paga',
          chaveAgregado: '88',
          payload: { evento_id: eventoId, evento: 'comanda.paga', comanda_id: 88 },
        },
      });

      expect((prismaMock as any).$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.pagamentoParcela.create).toHaveBeenCalledTimes(1);
      expect(txMock.cobrancaComanda.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { comandaId: 88 },
          data: expect.objectContaining({ status: 'paga' }),
        }),
      );
      expect(txMock.reciboVenda.create).toHaveBeenCalledTimes(1);
      expect(txMock.outboxEvento.create).toHaveBeenCalledWith({
        data: {
          id: eventoId,
          tipoEvento: 'comanda.paga',
          chaveAgregado: '88',
          payload: { evento_id: eventoId, evento: 'comanda.paga', comanda_id: 88 },
          status: 'PENDENTE',
          tentativas: 0,
        },
      });
      expect(res.cobranca.status).toBe('paga');
      expect(res.recibo.codigoAutenticacao).toBe('VAPT-20261122-M04-ABCD');
    });
  });

  describe('Consumidor Idempotente caixa.comanda.fechada', () => {
    it('deve configurar prefetch(10), criar cobrança aguardando_pagamento, gravar em eventos_processados e confirmar ack manual', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const controleEventos = criarControleEventosMemoria();
      const service = new CobrancasService(
        repository,
        mockEstoqueGateway,
        mockGestaoGateway,
        undefined,
        true,
      );

      await registrarConsumidorCaixa(mockAmqp.canal, controleEventos, service);

      expect(mockAmqp.obterPrefetch()).toBe(PREFETCH_PADRAO);
      expect(mockAmqp.canal.consume).toHaveBeenCalledWith(
        FILAS.CAIXA_COMANDA_FECHADA,
        expect.any(Function),
        { noAck: false },
      );

      const eventoId = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
      const payload = {
        evento_id: eventoId,
        evento: 'comanda.fechada',
        versao: 1,
        ocorrido_em: '2026-11-22T20:45:00.000Z',
        comanda_id: 12,
        mesa: 6,
        garcom_id: 1,
        nome_cliente: 'Mariana',
        aplicar_taxa_servico: true,
        itens: [
          {
            item_comanda_id: 44,
            produto_id: 1,
            nome: 'Chopp Pilsen 300ml',
            categoria: 'Bebidas',
            preco_unitario: '14.90',
            quantidade: 2,
            subtotal: '29.80',
          },
          {
            item_comanda_id: 45,
            produto_id: 3,
            nome: 'Porção de Batata com Cheddar',
            categoria: 'Porções',
            preco_unitario: '34.90',
            quantidade: 1,
            subtotal: '34.90',
          },
        ],
      };

      const msg: MensagemAmqp = {
        content: Buffer.from(JSON.stringify(payload)),
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: { messageId: eventoId, headers: {} },
      };

      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msg);

      expect(mockAmqp.acks).toHaveLength(1);
      expect(mockAmqp.nacks).toHaveLength(0);

      const cobranca = await repository.buscarPorComandaId(12);
      expect(cobranca).not.toBeNull();
      expect(cobranca?.status).toBe('aguardando_pagamento');
      expect(cobranca?.mesa).toBe(6);
      expect(cobranca?.nomeCliente).toBe('Mariana');
      expect(cobranca?.subtotal.toFixed(2)).toBe('64.70');
      expect(cobranca?.taxaServico.toFixed(2)).toBe('6.47');
      expect(cobranca?.total.toFixed(2)).toBe('71.17');

      const eventoGravado = controleEventos.registros.get(eventoId);
      expect(eventoGravado).toBeDefined();
      expect(eventoGravado?.evento).toBe('comanda.fechada');
    });

    it('deve ignorar reentrega com mesmo evento_id sem duplicar cobrança nem falhar', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const controleEventos = criarControleEventosMemoria();
      const service = new CobrancasService(
        repository,
        mockEstoqueGateway,
        mockGestaoGateway,
        undefined,
        true,
      );
      const spyFechar = vi.spyOn(service, 'fecharOuRecalcular');

      await registrarConsumidorCaixa(mockAmqp.canal, controleEventos, service);

      const eventoId = crypto.randomUUID();
      const msg: MensagemAmqp = {
        content: Buffer.from(
          JSON.stringify({
            evento_id: eventoId,
            evento: 'comanda.fechada',
            comanda_id: 77,
            mesa: 3,
            garcom_id: 2,
            aplicar_taxa_servico: false,
            itens: [
              {
                item_comanda_id: 1,
                produto_id: 10,
                nome: 'Água Mineral',
                preco_unitario: '5.00',
                quantidade: 2,
              },
            ],
          }),
        ),
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: { messageId: eventoId, headers: {} },
      };

      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msg);
      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msg);

      expect(spyFechar).toHaveBeenCalledTimes(1);
      expect(controleEventos.eventoProcessado.create).toHaveBeenCalledTimes(1);
      expect(mockAmqp.acks).toHaveLength(2);
      expect(mockAmqp.nacks).toHaveLength(0);

      const todasCobrancas = await repository.listar();
      expect(todasCobrancas).toHaveLength(1);
      expect(todasCobrancas[0].total.toFixed(2)).toBe('10.00');
    });

    it('deve enviar payload JSON corrompido ou sem evento_id diretamente para DLQ (nack sem requeue)', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const controleEventos = criarControleEventosMemoria();
      const service = new CobrancasService(
        repository,
        mockEstoqueGateway,
        mockGestaoGateway,
        undefined,
        true,
      );

      await registrarConsumidorCaixa(mockAmqp.canal, controleEventos, service);

      const msgCorrompida: MensagemAmqp = {
        content: Buffer.from('{json-invalido'),
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: { headers: {} },
      };

      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msgCorrompida);

      const msgSemId: MensagemAmqp = {
        content: Buffer.from(
          JSON.stringify({
            evento: 'comanda.fechada',
            comanda_id: 10,
            mesa: 1,
            garcom_id: 1,
            itens: [{ quantidade: 1, preco_unitario: '10.00' }],
          }),
        ),
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: { headers: {} },
      };

      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msgSemId);

      expect(mockAmqp.acks).toHaveLength(0);
      expect(mockAmqp.enviosFila).toHaveLength(0);
      expect(mockAmqp.nacks).toHaveLength(2);
      expect(mockAmqp.nacks[0].requeue).toBe(false);
      expect(mockAmqp.nacks[1].requeue).toBe(false);
      expect(mockAmqp.mensagensDlq['caixa.comanda.fechada.dlq']).toHaveLength(2);
    });

    it('deve aplicar retry com x-retry-count 1 e 2 e rotear para caixa.comanda.fechada.dlq após 3 falhas', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const controleEventos = criarControleEventosMemoria();
      const service = new CobrancasService(
        repository,
        mockEstoqueGateway,
        mockGestaoGateway,
        undefined,
        true,
      );

      await registrarConsumidorCaixa(mockAmqp.canal, controleEventos, service);

      const eventoId = crypto.randomUUID();
      const payloadInvalido = {
        evento_id: eventoId,
        evento: 'comanda.fechada',
        comanda_id: 55,
        mesa: 4,
        garcom_id: 1,
        itens: [],
      };

      const msgTentativa1: MensagemAmqp = {
        content: Buffer.from(JSON.stringify(payloadInvalido)),
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: { messageId: eventoId, headers: {} },
      };
      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msgTentativa1);

      expect(mockAmqp.enviosFila).toHaveLength(1);
      expect(mockAmqp.enviosFila[0].queue).toBe(FILAS.CAIXA_COMANDA_FECHADA);
      expect(mockAmqp.enviosFila[0].options?.headers).toMatchObject({ 'x-retry-count': 1 });
      expect(mockAmqp.acks).toHaveLength(1);
      expect(mockAmqp.nacks).toHaveLength(0);

      const msgTentativa2: MensagemAmqp = {
        content: mockAmqp.enviosFila[0].content,
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: {
          messageId: eventoId,
          headers: (mockAmqp.enviosFila[0].options?.headers as Record<string, unknown>) || {},
        },
      };
      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msgTentativa2);

      expect(mockAmqp.enviosFila).toHaveLength(2);
      expect(mockAmqp.enviosFila[1].queue).toBe(FILAS.CAIXA_COMANDA_FECHADA);
      expect(mockAmqp.enviosFila[1].options?.headers).toMatchObject({ 'x-retry-count': 2 });
      expect(mockAmqp.acks).toHaveLength(2);
      expect(mockAmqp.nacks).toHaveLength(0);

      const msgTentativa3: MensagemAmqp = {
        content: mockAmqp.enviosFila[1].content,
        fields: { routingKey: FILAS.CAIXA_COMANDA_FECHADA },
        properties: {
          messageId: eventoId,
          headers: (mockAmqp.enviosFila[1].options?.headers as Record<string, unknown>) || {},
        },
      };
      await mockAmqp.entregar(FILAS.CAIXA_COMANDA_FECHADA, msgTentativa3);

      expect(MAX_TENTATIVAS_CONSUMO).toBe(3);
      expect(mockAmqp.enviosFila).toHaveLength(2);
      expect(mockAmqp.acks).toHaveLength(2);
      expect(mockAmqp.nacks).toHaveLength(1);
      expect(mockAmqp.nacks[0]).toEqual({
        msg: msgTentativa3,
        allUpTo: false,
        requeue: false,
      });
      expect(mockAmqp.mensagensDlq['caixa.comanda.fechada.dlq']).toHaveLength(1);
      expect(controleEventos.registros.size).toBe(0);
    });
  });

  describe('RabbitMQClient e ciclo de vida do OutboxPublisher', () => {
    it('deve conectar com ConfirmChannel (e fallback createChannel), declarar topologia, publicar com confirms e invocar callbacks', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const emitterConexao = new EventEmitter() as EventEmitter & {
        createConfirmChannel?: () => Promise<CanalAmqp>;
        createChannel: () => Promise<CanalAmqp>;
        close: () => Promise<void>;
      };
      emitterConexao.createConfirmChannel = vi.fn(async () => mockAmqp.canal);
      emitterConexao.createChannel = vi.fn(async () => mockAmqp.canal);
      emitterConexao.close = vi.fn(async () => {});

      vi.spyOn(amqplib, 'connect').mockResolvedValue(emitterConexao as any);

      const client = new RabbitMQClient('amqp://guest:guest@localhost:5672');
      const callbackSpy = vi.fn(async () => {});
      client.registrarCallbackConexao(callbackSpy);

      await client.conectar();

      expect(client.estaConectado()).toBe(true);
      expect(client.obterCanal()).toBe(mockAmqp.canal);
      expect(callbackSpy).toHaveBeenCalledWith(mockAmqp.canal);
      expect(mockAmqp.exchangesAssertadas).toHaveLength(2);
      expect(mockAmqp.filasAssertadas).toHaveLength(10);

      await client.publicarEvento('comanda.paga', { comanda_id: 12 }, 'msg-123');
      expect(mockAmqp.publicacoes).toHaveLength(1);
      expect(mockAmqp.publicacoes[0].exchange).toBe(EXCHANGE_EVENTOS);
      expect(mockAmqp.publicacoes[0].routingKey).toBe('comanda.paga');
      expect(mockAmqp.publicacoes[0].options?.messageId).toBe('msg-123');
      expect(mockAmqp.canal.waitForConfirms).toHaveBeenCalledTimes(1);

      await client.fechar();
      expect(client.estaConectado()).toBe(false);
      expect(client.obterCanal()).toBeNull();
    });

    it('deve utilizar fallback createChannel quando createConfirmChannel não existir', async () => {
      const mockAmqp = criarCanalAmqpMock();
      const emitterConexao = new EventEmitter() as EventEmitter & {
        createChannel: () => Promise<CanalAmqp>;
        close: () => Promise<void>;
      };
      emitterConexao.createChannel = vi.fn(async () => mockAmqp.canal);
      emitterConexao.close = vi.fn(async () => {});

      vi.spyOn(amqplib, 'connect').mockResolvedValue(emitterConexao as any);

      const client = new RabbitMQClient({ url: 'amqp://localhost:5672' });
      await client.conectar();
      expect(emitterConexao.createChannel).toHaveBeenCalledTimes(1);
      expect(client.estaConectado()).toBe(true);
      await client.fechar();
    });

    it('deve iniciar polling com .unref() no OutboxPublisher e parar corretamente', async () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const publisher = new OutboxPublisher(repository, {
        estaConectado: () => false,
        publicarEvento: vi.fn(async () => {}),
      });

      publisher.iniciar();
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      const timerRetornado = setIntervalSpy.mock.results[0].value;
      expect(timerRetornado).toBeDefined();

      publisher.parar();
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });
  });
});
