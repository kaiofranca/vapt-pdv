import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import amqplib from 'amqplib';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { validarEnv } from '../src/config/env';
import { ClienteBanco } from '../src/shared/prisma';
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
  registrarConsumidorIdempotente,
  registrarConsumidoresCore,
} from '../src/shared/messaging';
import { ProdutosRepositoryPrisma } from '../src/modules/produtos/produtos.repository';
import { ProdutosService } from '../src/modules/produtos/produtos.service';
import type { ICaixaGateway } from '../src/shared/gateways/caixa.gateway';
import type { IGestaoGateway } from '../src/shared/gateways/gestao.gateway';
import type { IKdsGateway } from '../src/shared/gateways/kds.gateway';

const RAIZ_REPO = path.resolve(__dirname, '..', '..');

function criarCanalAmqpMock() {
  const exchanges: Array<{ name: string; type: string; options: unknown }> = [];
  const queues: Array<{ name: string; options: unknown }> = [];
  const bindings: Array<{ queue: string; source: string; pattern: string }> = [];
  const published: Array<{
    exchange: string;
    routingKey: string;
    content: Buffer;
    options: Record<string, unknown>;
  }> = [];
  const sentToQueue: Array<{
    queue: string;
    content: Buffer;
    options: Record<string, unknown>;
  }> = [];
  const consumers = new Map<
    string,
    {
      handler: (msg: MensagemAmqp | null) => Promise<void> | void;
      options?: unknown;
    }
  >();

  const canal: CanalAmqp & {
    prefetch: ReturnType<typeof vi.fn>;
    ack: ReturnType<typeof vi.fn>;
    nack: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    sendToQueue: ReturnType<typeof vi.fn>;
    waitForConfirms: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  } = {
    assertExchange: vi.fn(async (name: string, type: string, options?: unknown) => {
      exchanges.push({ name, type, options });
      return { exchange: name };
    }),
    assertQueue: vi.fn(async (name: string, options?: unknown) => {
      queues.push({ name, options });
      return { queue: name, messageCount: 0, consumerCount: 0 };
    }),
    bindQueue: vi.fn(async (queue: string, source: string, pattern: string) => {
      bindings.push({ queue, source, pattern });
      return {};
    }),
    prefetch: vi.fn(async () => ({})),
    publish: vi.fn(
      (
        exchange: string,
        routingKey: string,
        content: Buffer,
        options: Record<string, unknown> = {},
      ) => {
        published.push({ exchange, routingKey, content, options });
        return true;
      },
    ),
    sendToQueue: vi.fn(
      (
        queue: string,
        content: Buffer,
        options: Record<string, unknown> = {},
      ) => {
        sentToQueue.push({ queue, content, options });
        return true;
      },
    ),
    consume: vi.fn(
      async (
        queue: string,
        onMessage: (msg: MensagemAmqp | null) => Promise<void> | void,
        options?: unknown,
      ) => {
        consumers.set(queue, { handler: onMessage, options });
        return { consumerTag: `tag-${queue}` };
      },
    ),
    ack: vi.fn(),
    nack: vi.fn(),
    waitForConfirms: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };

  return {
    canal,
    exchanges,
    queues,
    bindings,
    published,
    sentToQueue,
    consumers,
  };
}

function criarMensagem(
  conteudo: unknown,
  overrides?: Partial<MensagemAmqp>,
): MensagemAmqp {
  const buffer = Buffer.isBuffer(conteudo)
    ? conteudo
    : Buffer.from(
        typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo),
        'utf8',
      );
  return {
    content: buffer,
    fields: {
      routingKey: 'evento.teste',
      deliveryTag: 1,
      ...(overrides?.fields ?? {}),
    },
    properties: {
      contentType: 'application/json',
      headers: {},
      ...(overrides?.properties ?? {}),
    },
  };
}

describe('Epic 4 — Mensageria RabbitMQ, Transactional Outbox e Consumidores Idempotentes (Core)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Infraestrutura Docker Compose, .env.docker.example e Migrations SQL (Módulo 4)', () => {
    it('docker-compose.yml define 9 containers, RabbitMQ 3.13 management, volume rabbitmq_data, portas e healthchecks nos 4 serviços', () => {
      const caminhoCompose = path.join(RAIZ_REPO, 'docker-compose.yml');
      expect(fs.existsSync(caminhoCompose)).toBe(true);
      const conteudo = fs.readFileSync(caminhoCompose, 'utf8');

      const servicosEsperados = [
        'postgres-core',
        'postgres-kds',
        'postgres-caixa',
        'postgres-gestao',
        'vapt-pdv-core',
        'kds-service',
        'caixa-service',
        'gestao-service',
        'rabbitmq',
      ];
      for (const servico of servicosEsperados) {
        expect(conteudo).toContain(`${servico}:`);
      }

      expect(conteudo).toContain('rabbitmq:3.13-management-alpine');
      expect(conteudo).toContain('rabbitmq_data');
      expect(conteudo).toContain('5672}:5672');
      expect(conteudo).toContain('15672}:15672');
      expect(conteudo).toContain('rabbitmq-diagnostics');

      const ocorrenciasRabbitUrl = conteudo.match(/RABBITMQ_URL:/g) ?? [];
      expect(ocorrenciasRabbitUrl).toHaveLength(4);

      const blocosServicos = ['vapt-pdv-core', 'kds-service', 'caixa-service', 'gestao-service'];
      for (const bloco of blocosServicos) {
        const idx = conteudo.indexOf(`  ${bloco}:`);
        expect(idx).toBeGreaterThan(-1);
        const trecho = conteudo.slice(idx, idx + 1100);
        expect(trecho).toContain('RABBITMQ_URL:');
        expect(trecho).toMatch(/rabbitmq:\s*\n\s*condition:\s*service_healthy/);
      }
    });

    it('.env.docker.example e migrations SQL do Módulo 4 contêm outbox_eventos, eventos_processados e status_preparo', () => {
      const envExample = fs.readFileSync(
        path.join(RAIZ_REPO, '.env.docker.example'),
        'utf8',
      );
      for (const chave of [
        'RABBITMQ_USER=',
        'RABBITMQ_PASSWORD=',
        'RABBITMQ_PORT=',
        'RABBITMQ_MGMT_PORT=',
      ]) {
        expect(envExample).toContain(chave);
      }

      const migrationCore = fs.readFileSync(
        path.join(
          RAIZ_REPO,
          'backend',
          'prisma',
          'migrations',
          '20261122000000_add_outbox_eventos_processados_status_preparo',
          'migration.sql',
        ),
        'utf8',
      );
      expect(migrationCore).toContain('status_preparo');
      expect(migrationCore).toContain('CREATE TABLE "outbox_eventos"');
      expect(migrationCore).toContain('CREATE TABLE "eventos_processados"');
      expect(migrationCore).toContain('outbox_pendentes_idx');

      const migrationKds = fs.readFileSync(
        path.join(
          RAIZ_REPO,
          'services',
          'kds-service',
          'prisma',
          'migrations',
          '20261122000000_add_outbox_eventos',
          'migration.sql',
        ),
        'utf8',
      );
      expect(migrationKds).toContain('CREATE TABLE "outbox_eventos"');
      expect(migrationKds).toContain('outbox_pendentes_idx');

      const migrationCaixa = fs.readFileSync(
        path.join(
          RAIZ_REPO,
          'services',
          'caixa-service',
          'prisma',
          'migrations',
          '20261105000000_init_caixa',
          'migration.sql',
        ),
        'utf8',
      );
      expect(migrationCaixa).toContain('CREATE TABLE "outbox_eventos"');
      expect(migrationCaixa).toContain('CREATE TABLE "eventos_processados"');

      const migrationGestao = fs.readFileSync(
        path.join(
          RAIZ_REPO,
          'services',
          'gestao-service',
          'prisma',
          'migrations',
          '20261105000000_init_gestao',
          'migration.sql',
        ),
        'utf8',
      );
      expect(migrationGestao).toContain('CREATE TABLE "eventos_processados"');
    });
  });

  describe('2. Topologia RabbitMQ, Cliente AMQP e Validação de Env', () => {
    it('declararTopologiaRabbitMQ declara exchanges, 5 filas principais, 5 DLQs e todos os bindings com DLX', async () => {
      const { canal, exchanges, queues, bindings } = criarCanalAmqpMock();

      await declararTopologiaRabbitMQ(canal);

      expect(exchanges).toEqual([
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

      expect(DEFINICOES_FILAS).toHaveLength(5);
      expect(queues).toHaveLength(10);

      for (const def of DEFINICOES_FILAS) {
        expect(queues).toContainEqual({
          name: def.dlq,
          options: { durable: true },
        });
        expect(bindings).toContainEqual({
          queue: def.dlq,
          source: EXCHANGE_DLX,
          pattern: def.dlq,
        });

        expect(queues).toContainEqual({
          name: def.fila,
          options: {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': EXCHANGE_DLX,
              'x-dead-letter-routing-key': def.dlq,
            },
          },
        });

        for (const rk of def.routingKeys) {
          expect(bindings).toContainEqual({
            queue: def.fila,
            source: EXCHANGE_EVENTOS,
            pattern: rk,
          });
        }
      }

      expect(bindings).toContainEqual({
        queue: FILAS.KDS_ITEM_LANCADO,
        source: EXCHANGE_EVENTOS,
        pattern: 'item.lancado',
      });
      expect(bindings).toContainEqual({
        queue: FILAS.KDS_ITEM_LANCADO,
        source: EXCHANGE_EVENTOS,
        pattern: 'comanda.cancelada',
      });
      expect(bindings).toContainEqual({
        queue: FILAS.GESTAO_EVENTOS,
        source: EXCHANGE_EVENTOS,
        pattern: '#',
      });
    });

    it('mensageriaHabilitada e validarEnv respeitam RABBITMQ_URL vazia, disabled e válida', () => {
      expect(mensageriaHabilitada('')).toBe(false);
      expect(mensageriaHabilitada('   ')).toBe(false);
      expect(mensageriaHabilitada('disabled')).toBe(false);
      expect(mensageriaHabilitada('DISABLED')).toBe(false);
      expect(mensageriaHabilitada('amqp://vaptpdv:secret@rabbitmq:5672')).toBe(true);

      const envSemRabbit = validarEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        RABBITMQ_URL: '   ',
      });
      expect(envSemRabbit).not.toHaveProperty('RABBITMQ_URL');

      const envComRabbit = validarEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        RABBITMQ_URL: 'amqp://vaptpdv:secret@rabbitmq:5672',
      });
      expect(envComRabbit.RABBITMQ_URL).toBe('amqp://vaptpdv:secret@rabbitmq:5672');
    });

    it('RabbitMQClient conecta com ConfirmChannel, publica com deliveryMode 2 + waitForConfirms e reconecta invocando callbacks', async () => {
      const mockChannel = criarCanalAmqpMock();
      const fakeConn = new EventEmitter() as EventEmitter & {
        createConfirmChannel: ReturnType<typeof vi.fn>;
        createChannel: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
      };
      fakeConn.createConfirmChannel = vi.fn(async () => mockChannel.canal);
      fakeConn.createChannel = vi.fn(async () => mockChannel.canal);
      fakeConn.close = vi.fn(async () => undefined);

      const connectSpy = vi
        .spyOn(amqplib, 'connect')
        .mockResolvedValue(fakeConn as any);

      const client = new RabbitMQClient(
        'amqp://vaptpdv:secret@localhost:5672',
        undefined,
        { atrasoBaseReconexaoMs: 20, atrasoMaximoReconexaoMs: 50 },
      );

      const cbConexao = vi.fn();
      client.registrarCallbackConexao(cbConexao);

      await client.conectar();
      expect(client.estaConectado()).toBe(true);
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(cbConexao).toHaveBeenCalledTimes(1);

      const payload = { evento_id: 'evt-1', evento: 'item.lancado' };
      await client.publicarEvento('item.lancado', payload, 'evt-1');

      expect(mockChannel.published).toHaveLength(1);
      expect(mockChannel.published[0].exchange).toBe(EXCHANGE_EVENTOS);
      expect(mockChannel.published[0].routingKey).toBe('item.lancado');
      expect(JSON.parse(mockChannel.published[0].content.toString('utf8'))).toEqual(payload);
      expect(mockChannel.published[0].options).toMatchObject({
        persistent: true,
        deliveryMode: 2,
        messageId: 'evt-1',
        contentType: 'application/json',
      });
      expect(mockChannel.canal.waitForConfirms).toHaveBeenCalledTimes(1);

      fakeConn.emit('close');
      expect(client.estaConectado()).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(connectSpy).toHaveBeenCalledTimes(2);
      expect(cbConexao).toHaveBeenCalledTimes(2);

      await client.fechar();
      expect(client.estaConectado()).toBe(false);
    });
  });

  describe('3. Transactional Outbox (gravarEventoOutbox & OutboxPublisher)', () => {
    it('gravarEventoOutbox degrada silenciosamente quando outboxEvento não existe no cliente/mock', async () => {
      const id = await gravarEventoOutbox(
        { $queryRaw: vi.fn() } as ClienteBanco,
        {
          tipoEvento: 'item.lancado',
          chaveAgregado: 'comanda:1',
          payload: { teste: true },
        },
      );
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('OutboxPublisher publica com persistent/deliveryMode 2/messageId, marca PUBLICADO e recupera após falha transitória incrementando tentativas', async () => {
      const registros = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          tipoEvento: 'item.lancado',
          chaveAgregado: 'comanda:10',
          payload: { evento_id: '11111111-1111-4111-8111-111111111111', evento: 'item.lancado' },
          status: 'PENDENTE',
          tentativas: 0,
          criadoEm: new Date('2026-11-22T20:00:00.000Z'),
          publicadoEm: null as Date | null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          tipoEvento: 'comanda.fechada',
          chaveAgregado: 'comanda:10',
          payload: { evento_id: '22222222-2222-4222-8222-222222222222', evento: 'comanda.fechada' },
          status: 'PENDENTE',
          tentativas: 0,
          criadoEm: new Date('2026-11-22T20:01:00.000Z'),
          publicadoEm: null as Date | null,
        },
      ];

      const { canal, published } = criarCanalAmqpMock();
      let falharSegundoNoCiclo1 = true;

      const prismaOutbox = {
        outboxEvento: {
          findMany: vi.fn(async ({ where }: any) =>
            registros.filter((r) => r.status === where.status),
          ),
          update: vi.fn(async ({ where, data }: any) => {
            const reg = registros.find((r) => r.id === where.id)!;
            if (data.status !== undefined) {
              reg.status = data.status;
            }
            if (data.publicadoEm !== undefined) {
              reg.publicadoEm = data.publicadoEm;
            }
            if (data.tentativas?.increment) {
              reg.tentativas += data.tentativas.increment;
            }
            return reg;
          }),
        },
      };

      const publicarFn = vi.fn(
        async (tipoEvento: string, payload: unknown, messageId: string) => {
          if (
            falharSegundoNoCiclo1 &&
            messageId === '22222222-2222-4222-8222-222222222222'
          ) {
            throw new Error('Broker temporariamente indisponível');
          }
          canal.publish(
            EXCHANGE_EVENTOS,
            tipoEvento,
            Buffer.from(JSON.stringify(payload), 'utf8'),
            {
              persistent: true,
              deliveryMode: 2,
              messageId,
              contentType: 'application/json',
            },
          );
        },
      );

      const publisher = new OutboxPublisher(prismaOutbox, publicarFn, undefined, {
        intervaloMs: 1000,
        tamanhoLote: 50,
      });

      await publisher.processarLote();

      expect(registros[0].status).toBe('PUBLICADO');
      expect(registros[0].publicadoEm).toBeInstanceOf(Date);
      expect(registros[0].tentativas).toBe(0);

      expect(registros[1].status).toBe('PENDENTE');
      expect(registros[1].tentativas).toBe(1);
      expect(registros[1].publicadoEm).toBeNull();

      expect(published).toHaveLength(1);
      expect(published[0].options).toMatchObject({
        persistent: true,
        deliveryMode: 2,
        messageId: '11111111-1111-4111-8111-111111111111',
      });

      falharSegundoNoCiclo1 = false;
      await publisher.processarLote();

      expect(registros[1].status).toBe('PUBLICADO');
      expect(registros[1].publicadoEm).toBeInstanceOf(Date);
      expect(registros[1].tentativas).toBe(1);
      expect(published).toHaveLength(2);
      expect(published[1].options).toMatchObject({
        persistent: true,
        deliveryMode: 2,
        messageId: '22222222-2222-4222-8222-222222222222',
      });

      publisher.iniciar();
      publisher.parar();
    });

    it('OutboxPublisher possui guarda de reentrância para evitar publicação concorrente duplicada', async () => {
      let resolverPublicacao!: () => void;
      const bloqueioPublicacao = new Promise<void>((resolve) => {
        resolverPublicacao = resolve;
      });

      const prismaOutbox = {
        outboxEvento: {
          findMany: vi.fn(async () => [
            {
              id: '33333333-3333-4333-8333-333333333333',
              tipoEvento: 'item.lancado',
              chaveAgregado: 'comanda:1',
              payload: { evento_id: '33333333-3333-4333-8333-333333333333' },
              status: 'PENDENTE',
              tentativas: 0,
              criadoEm: new Date(),
            },
          ]),
          update: vi.fn(async () => ({})),
        },
      };

      const publicarFn = vi.fn(async () => {
        await bloqueioPublicacao;
      });

      const publisher = new OutboxPublisher(prismaOutbox, publicarFn);
      const p1 = publisher.processarLote();
      const p2 = publisher.processarLote();
      await p2;

      expect(prismaOutbox.outboxEvento.findMany).toHaveBeenCalledTimes(1);
      expect(publicarFn).toHaveBeenCalledTimes(1);

      resolverPublicacao();
      await p1;
      expect(prismaOutbox.outboxEvento.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Integração Core via buildApp com usarMensageria: true', () => {
    it('lancarItem, fechar, cancelar, pagar e repor gravam eventos canônicos em outbox_eventos na mesma transação sem disparar gateways HTTP', async () => {
      const outboxRegistros: any[] = [];
      const movimentosEstoque: any[] = [];
      const itensComanda: any[] = [];
      const usuarios = [
        { id: 1, nome: 'Lucas Garçom', perfil: 'garcom', ativo: true },
      ];
      const produtos = [
        {
          id: 10,
          nome: 'Chopp Pilsen 300ml',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('14.90'),
          estoque: 10,
          estoque_minimo: 8,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
        {
          id: 20,
          nome: 'Porção de Batata',
          categoria: 'Porções',
          preco: new Prisma.Decimal('34.90'),
          estoque: 20,
          estoque_minimo: 5,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];
      const comandas: any[] = [
        {
          id: 1,
          mesa: 6,
          nome_cliente: 'Mariana',
          garcom_id: 1,
          status: 'aberta',
          subtotal: null,
          taxa_servico: null,
          total: null,
          forma_pagamento: null,
          aberta_em: new Date('2026-11-22T20:00:00.000Z'),
          fechada_em: null,
          paga_em: null,
          cancelada_em: null,
          motivo_cancelamento: null,
          itens: itensComanda,
        },
        {
          id: 2,
          mesa: 9,
          nome_cliente: 'João',
          garcom_id: 1,
          status: 'aberta',
          subtotal: null,
          taxa_servico: null,
          total: null,
          forma_pagamento: null,
          aberta_em: new Date('2026-11-22T20:10:00.000Z'),
          fechada_em: null,
          paga_em: null,
          cancelada_em: null,
          motivo_cancelamento: null,
          itens: [],
        },
      ];

      const prisma: Partial<ClienteBanco> = {
        $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
        $disconnect: vi.fn(async () => undefined),
        $transaction: vi.fn(async (op: any) => op(prisma)),
        usuario: {
          findUnique: vi.fn(async ({ where }: any) =>
            usuarios.find((u) => u.id === where.id) ?? null,
          ),
        } as any,
        produto: {
          findUnique: vi.fn(async ({ where }: any) => {
            const p = produtos.find((item) => item.id === where.id);
            return p ? { ...p } : null;
          }),
          update: vi.fn(async ({ where, data }: any) => {
            const p = produtos.find((item) => item.id === where.id)!;
            if (data.estoque?.decrement !== undefined) {
              p.estoque -= Number(data.estoque.decrement);
            } else if (data.estoque?.increment !== undefined) {
              p.estoque += Number(data.estoque.increment);
            }
            p.atualizado_em = new Date();
            return { ...p };
          }),
        } as any,
        movimentoEstoque: {
          findFirst: vi.fn(async ({ where }: any) =>
            movimentosEstoque.find(
              (m) =>
                m.comanda_id === where.comanda_id &&
                m.produto_id === where.produto_id,
            ) ?? null,
          ),
          create: vi.fn(async ({ data }: any) => {
            const mov = {
              id: movimentosEstoque.length + 1,
              ...data,
              comanda_id: data.comanda_id ?? null,
              criado_em: new Date(),
            };
            movimentosEstoque.push(mov);
            return mov;
          }),
        } as any,
        comanda: {
          findUnique: vi.fn(async ({ where }: any) => {
            const c = comandas.find((item) => item.id === where.id);
            if (!c) return null;
            return {
              ...c,
              itens: c.id === 1 ? [...itensComanda] : [],
            };
          }),
          update: vi.fn(async ({ where, data }: any) => {
            const c = comandas.find((item) => item.id === where.id)!;
            Object.assign(c, data);
            return {
              ...c,
              itens: c.id === 1 ? [...itensComanda] : [],
            };
          }),
        } as any,
        itemComanda: {
          create: vi.fn(async ({ data }: any) => {
            const item = {
              id: itensComanda.length + 44,
              ...data,
              status_preparo: 'recebido',
            };
            itensComanda.push(item);
            return item;
          }),
        } as any,
        outboxEvento: {
          create: vi.fn(async ({ data }: any) => {
            const reg = { ...data, criadoEm: new Date(), publicadoEm: null };
            outboxRegistros.push(reg);
            return reg;
          }),
          findMany: vi.fn(async () => []),
          update: vi.fn(async () => ({})),
        } as any,
      };

      const caixaGatewayMock: ICaixaGateway = {
        notificarFechamento: vi.fn(async () => ({ sucesso: true })),
      };
      const gestaoGatewayMock: IGestaoGateway = {
        notificarEvento: vi.fn(async () => ({ sucesso: true })),
        notificarComandaPaga: vi.fn(async () => ({ sucesso: true })),
      };
      const kdsGatewayMock: IKdsGateway = {
        despacharFicha: vi.fn(async () => ({ sucesso: true })),
        consultarPendencias: vi.fn(async () => ({
          possui_pendencias: false,
          pendencias: [],
        })),
        cancelarFichas: vi.fn(async () => ({ sucesso: true, canceladas: 0 })),
      };

      const outboxPublisher = new OutboxPublisher(
        prisma as ClienteBanco,
        vi.fn(async () => undefined),
      );
      const notificarSpy = vi.spyOn(outboxPublisher, 'notificarNovoEvento');

      const app = await buildApp({
        prisma: prisma as ClienteBanco,
        caixaGateway: caixaGatewayMock,
        gestaoGateway: gestaoGatewayMock,
        kdsGateway: kdsGatewayMock,
        outboxPublisher,
        usarMensageria: true,
        logger: false,
      });

      const resItem1 = await app.inject({
        method: 'POST',
        url: '/comandas/1/itens',
        payload: { produto_id: 10, quantidade: 2 },
      });
      expect(resItem1.statusCode).toBe(201);

      const resItem2 = await app.inject({
        method: 'POST',
        url: '/comandas/1/itens',
        payload: { produto_id: 20, quantidade: 1, observacao: 'Sem cebola' },
      });
      expect(resItem2.statusCode).toBe(201);

      const resFechar = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: true },
      });
      expect(resFechar.statusCode).toBe(200);
      expect(resFechar.json().integracao_caixa_pendente).toBe(false);

      const resPagar = await app.inject({
        method: 'POST',
        url: '/comandas/1/pagar',
        payload: { forma_pagamento: 'pix' },
      });
      expect(resPagar.statusCode).toBe(200);

      const resCancelar = await app.inject({
        method: 'POST',
        url: '/comandas/2/cancelar',
        payload: { motivo: 'Cliente desistiu antes do preparo' },
      });
      expect(resCancelar.statusCode).toBe(200);

      const resRepor = await app.inject({
        method: 'POST',
        url: '/produtos/10/repor',
        payload: { quantidade: 5, motivo: 'Entrega fornecedor' },
      });
      expect(resRepor.statusCode).toBe(200);

      expect(kdsGatewayMock.despacharFicha).not.toHaveBeenCalled();
      expect(kdsGatewayMock.cancelarFichas).not.toHaveBeenCalled();
      expect(caixaGatewayMock.notificarFechamento).not.toHaveBeenCalled();
      expect(gestaoGatewayMock.notificarEvento).not.toHaveBeenCalled();
      expect(gestaoGatewayMock.notificarComandaPaga).not.toHaveBeenCalled();
      expect(notificarSpy).toHaveBeenCalledTimes(6);

      expect(outboxRegistros.map((r) => r.tipoEvento)).toEqual([
        'item.lancado',
        'item.lancado',
        'comanda.fechada',
        'estoque.movimentado',
        'estoque.movimentado',
        'comanda.paga',
        'comanda.cancelada',
        'estoque.movimentado',
      ]);

      const evtItem1 = outboxRegistros[0].payload;
      expect(evtItem1).toMatchObject({
        evento: 'item.lancado',
        versao: 1,
        comanda_id: 1,
        produto_id: 10,
        mesa: 6,
        garcom_id: 1,
        nome_garcom: 'Lucas Garçom',
        categoria: 'Bebidas',
        setor: 'bar',
        preco_copiado: '14.90',
        quantidade: 2,
      });

      const evtItem2 = outboxRegistros[1].payload;
      expect(evtItem2).toMatchObject({
        evento: 'item.lancado',
        setor: 'cozinha',
        observacao: 'Sem cebola',
      });

      const evtFechada = outboxRegistros[2].payload;
      expect(evtFechada).toMatchObject({
        evento: 'comanda.fechada',
        comanda_id: 1,
        subtotal: '64.70',
        taxa_servico: '6.47',
        total: '71.17',
      });
      expect(evtFechada.itens).toEqual([
        expect.objectContaining({
          produto_id: 10,
          categoria: 'Bebidas',
          preco_unitario: '14.90',
          quantidade: 2,
          subtotal: '29.80',
        }),
        expect.objectContaining({
          produto_id: 20,
          categoria: 'Porções',
          preco_unitario: '34.90',
          quantidade: 1,
          subtotal: '34.90',
        }),
      ]);

      const evtEstoqueSaida = outboxRegistros[3].payload;
      expect(evtEstoqueSaida).toMatchObject({
        evento: 'estoque.movimentado',
        produto_id: 10,
        tipo: 'saida',
        quantidade: -2,
        estoque_atual: 8,
        estoque_minimo: 8,
        abaixo_do_minimo: true,
      });

      const evtComandaPaga = outboxRegistros[5].payload;
      expect(evtComandaPaga).toMatchObject({
        evento: 'comanda.paga',
        comanda_id: 1,
        garcom_nome: 'Lucas Garçom',
        forma_pagamento: 'pix',
        total: '71.17',
      });

      const evtCancelada = outboxRegistros[6].payload;
      expect(evtCancelada).toMatchObject({
        evento: 'comanda.cancelada',
        comanda_id: 2,
        mesa: 9,
        motivo_cancelamento: 'Cliente desistiu antes do preparo',
      });

      const evtReposicao = outboxRegistros[7].payload;
      expect(evtReposicao).toMatchObject({
        evento: 'estoque.movimentado',
        produto_id: 10,
        tipo: 'ENTRADA_REPOSICAO',
        quantidade: 5,
        estoque_atual: 13,
        abaixo_do_minimo: false,
      });

      await app.close();
    });
  });

  describe('5. Consumidores Idempotentes do Core, Retry e DLQ', () => {
    it('consumidor pdv.item.pronto atualiza status_preparo = "pronto", confirma ack manual e ignora reentrega duplicada', async () => {
      const { canal, consumers } = criarCanalAmqpMock();
      const itens = [{ id: 45, comanda_id: 12, status_preparo: 'recebido' }];
      const eventosProcessados: Array<{ eventoId: string; evento: string }> = [];

      const prisma: Partial<ClienteBanco> = {
        $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
        $transaction: vi.fn(async (op: any) => op(prisma)),
        itemComanda: {
          updateMany: vi.fn(async ({ where, data }: any) => {
            let count = 0;
            for (const item of itens) {
              if (item.id === where.id) {
                item.status_preparo = data.status_preparo;
                count += 1;
              }
            }
            return { count };
          }),
        } as any,
        eventoProcessado: {
          findUnique: vi.fn(async ({ where }: any) =>
            eventosProcessados.find((e) => e.eventoId === where.eventoId) ?? null,
          ),
          create: vi.fn(async ({ data }: any) => {
            eventosProcessados.push(data);
            return data;
          }),
        } as any,
      };

      const produtosService = new ProdutosService(
        new ProdutosRepositoryPrisma(prisma as ClienteBanco),
        undefined,
        undefined,
        true,
      );

      await registrarConsumidoresCore(
        canal,
        prisma as ClienteBanco,
        produtosService,
      );

      expect(canal.prefetch).toHaveBeenCalledWith(PREFETCH_PADRAO);
      const consumidorItemPronto = consumers.get(FILAS.PDV_ITEM_PRONTO);
      expect(consumidorItemPronto).toBeDefined();

      const msg = criarMensagem({
        evento_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        evento: 'item.pronto',
        versao: 1,
        item_comanda_id: 45,
        status_preparo: 'pronto',
      });

      await consumidorItemPronto!.handler(msg);

      expect(itens[0].status_preparo).toBe('pronto');
      expect(eventosProcessados).toHaveLength(1);
      expect(canal.ack).toHaveBeenCalledTimes(1);
      expect(canal.ack).toHaveBeenCalledWith(msg);

      await consumidorItemPronto!.handler(msg);
      expect(prisma.itemComanda!.updateMany).toHaveBeenCalledTimes(1);
      expect(eventosProcessados).toHaveLength(1);
      expect(canal.ack).toHaveBeenCalledTimes(2);
    });

    it('consumidor produtos.comanda.paga baixa estoque 1x, marca comanda paga, grava estoque.movimentado no Outbox e é idempotente', async () => {
      const { canal, consumers } = criarCanalAmqpMock();
      const produtos = [
        {
          id: 1,
          nome: 'Chopp Pilsen 300ml',
          categoria: 'Bebidas',
          preco: new Prisma.Decimal('14.90'),
          estoque: 10,
          estoque_minimo: 10,
          ativo: true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        },
      ];
      const comandas = [
        {
          id: 12,
          mesa: 6,
          status: 'fechada',
          forma_pagamento: null as string | null,
          paga_em: null as Date | null,
        },
      ];
      const movimentos: any[] = [];
      const outbox: any[] = [];
      const eventosProcessados: Array<{ eventoId: string; evento: string }> = [];

      const prisma: Partial<ClienteBanco> = {
        $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
        $transaction: vi.fn(async (op: any) => op(prisma)),
        produto: {
          findUnique: vi.fn(async ({ where }: any) => {
            const p = produtos.find((item) => item.id === where.id);
            return p ? { ...p } : null;
          }),
          update: vi.fn(async ({ where, data }: any) => {
            const p = produtos.find((item) => item.id === where.id)!;
            p.estoque -= Number(data.estoque.decrement);
            return { ...p };
          }),
        } as any,
        movimentoEstoque: {
          findFirst: vi.fn(async ({ where }: any) =>
            movimentos.find(
              (m) =>
                m.comanda_id === where.comanda_id &&
                m.produto_id === where.produto_id,
            ) ?? null,
          ),
          create: vi.fn(async ({ data }: any) => {
            const mov = { id: movimentos.length + 1, ...data };
            movimentos.push(mov);
            return mov;
          }),
        } as any,
        comanda: {
          findUnique: vi.fn(async ({ where }: any) =>
            comandas.find((c) => c.id === where.id) ?? null,
          ),
          update: vi.fn(async ({ where, data }: any) => {
            const c = comandas.find((item) => item.id === where.id)!;
            Object.assign(c, data);
            return { ...c };
          }),
        } as any,
        outboxEvento: {
          create: vi.fn(async ({ data }: any) => {
            outbox.push(data);
            return data;
          }),
          findMany: vi.fn(async () => []),
          update: vi.fn(async () => ({})),
        } as any,
        eventoProcessado: {
          findUnique: vi.fn(async ({ where }: any) =>
            eventosProcessados.find((e) => e.eventoId === where.eventoId) ?? null,
          ),
          create: vi.fn(async ({ data }: any) => {
            eventosProcessados.push(data);
            return data;
          }),
        } as any,
      };

      const outboxPublisher = new OutboxPublisher(
        prisma as ClienteBanco,
        vi.fn(async () => undefined),
      );
      const notificarSpy = vi.spyOn(outboxPublisher, 'notificarNovoEvento');
      const produtosService = new ProdutosService(
        new ProdutosRepositoryPrisma(prisma as ClienteBanco),
        undefined,
        outboxPublisher,
        true,
      );

      await registrarConsumidoresCore(
        canal,
        prisma as ClienteBanco,
        produtosService,
        outboxPublisher,
      );

      const consumidorComandaPaga = consumers.get(FILAS.PRODUTOS_COMANDA_PAGA);
      expect(consumidorComandaPaga).toBeDefined();

      const msg = criarMensagem({
        evento_id: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
        evento: 'comanda.paga',
        versao: 1,
        comanda_id: 12,
        forma_pagamento: 'pix',
        itens: [{ produto_id: 1, quantidade: 2 }],
      });

      await consumidorComandaPaga!.handler(msg);

      expect(produtos[0].estoque).toBe(8);
      expect(comandas[0].status).toBe('paga');
      expect(comandas[0].forma_pagamento).toBe('pix');
      expect(movimentos).toHaveLength(1);
      expect(outbox).toHaveLength(1);
      expect(outbox[0].tipoEvento).toBe('estoque.movimentado');
      expect(outbox[0].payload).toMatchObject({
        evento: 'estoque.movimentado',
        produto_id: 1,
        tipo: 'saida',
        quantidade: -2,
        estoque_atual: 8,
        estoque_minimo: 10,
        abaixo_do_minimo: true,
      });
      expect(eventosProcessados).toHaveLength(1);
      expect(canal.ack).toHaveBeenCalledTimes(1);
      expect(notificarSpy).toHaveBeenCalledTimes(1);

      await consumidorComandaPaga!.handler(msg);

      expect(produtos[0].estoque).toBe(8);
      expect(movimentos).toHaveLength(1);
      expect(outbox).toHaveLength(1);
      expect(eventosProcessados).toHaveLength(1);
      expect(canal.ack).toHaveBeenCalledTimes(2);
      expect(notificarSpy).toHaveBeenCalledTimes(1);
    });

    it('retry até 3 tentativas (x-retry-count 1, 2) seguido de nack(..., false, false) para .dlq e descarte imediato de JSON inválido', async () => {
      const { canal, consumers, sentToQueue } = criarCanalAmqpMock();

      await registrarConsumidorIdempotente(canal, {
        fila: FILAS.PDV_ITEM_PRONTO,
        processar: async () => {
          throw new Error('Erro simulado no banco');
        },
      });

      const consumidor = consumers.get(FILAS.PDV_ITEM_PRONTO)!;
      expect(consumidor.options).toEqual({ noAck: false });

      const msgInvalida = criarMensagem('{json-corrompido');
      await consumidor.handler(msgInvalida);
      expect(canal.nack).toHaveBeenCalledWith(msgInvalida, false, false);
      expect(sentToQueue).toHaveLength(0);

      const msgSemEventoId = criarMensagem({ evento: 'item.pronto' });
      await consumidor.handler(msgSemEventoId);
      expect(canal.nack).toHaveBeenCalledWith(msgSemEventoId, false, false);

      const msg1 = criarMensagem({
        evento_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        evento: 'item.pronto',
        item_comanda_id: 1,
      });
      await consumidor.handler(msg1);

      expect(sentToQueue).toHaveLength(1);
      expect(sentToQueue[0].queue).toBe(FILAS.PDV_ITEM_PRONTO);
      expect(sentToQueue[0].options.headers).toEqual({ 'x-retry-count': 1 });
      expect(canal.ack).toHaveBeenCalledWith(msg1);

      const msg2 = criarMensagem(
        {
          evento_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          evento: 'item.pronto',
          item_comanda_id: 1,
        },
        { properties: { headers: { 'x-retry-count': 1 } } },
      );
      await consumidor.handler(msg2);

      expect(sentToQueue).toHaveLength(2);
      expect(sentToQueue[1].options.headers).toEqual({ 'x-retry-count': 2 });
      expect(canal.ack).toHaveBeenCalledWith(msg2);

      const msg3 = criarMensagem(
        {
          evento_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          evento: 'item.pronto',
          item_comanda_id: 1,
        },
        { properties: { headers: { 'x-retry-count': 2 } } },
      );
      await consumidor.handler(msg3);

      expect(sentToQueue).toHaveLength(2);
      expect(canal.nack).toHaveBeenCalledWith(msg3, false, false);
    });
  });
});
