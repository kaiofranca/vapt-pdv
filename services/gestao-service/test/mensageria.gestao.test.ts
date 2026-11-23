import { EventEmitter } from 'events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EXCHANGE_DLX,
  EXCHANGE_EVENTOS,
  FILAS,
  CanalAmqp,
  MensagemAmqp,
  RabbitMQClient,
  declararTopologiaRabbitMQ,
  mensageriaHabilitada,
  registrarConsumidorGestao,
} from '../src/shared/messaging';
import { validarEnv } from '../src/config/env';
import { GestaoService } from '../src/modules/gestao/gestao.service';
import { MemoriaGestaoRepository } from './helpers/memoria.repository';

interface ChamadaSendToQueue {
  queue: string;
  content: Buffer;
  options: Record<string, any>;
}

class CanalAmqpSimulado implements CanalAmqp {
  public exchangesDeclaradas: Array<{ nome: string; tipo: string; options?: Record<string, any> }> = [];
  public filasDeclaradas: Array<{ nome: string; options?: Record<string, any> }> = [];
  public bindingsDeclarados: Array<{ fila: string; exchange: string; pattern: string }> = [];
  public prefetchConfigurado: number | null = null;
  public handlersPorFila = new Map<string, (msg: MensagemAmqp | null) => Promise<void> | void>();
  public opcoesConsumePorFila = new Map<string, Record<string, any>>();
  public acks: MensagemAmqp[] = [];
  public nacks: Array<{ msg: MensagemAmqp; allUpTo?: boolean; requeue?: boolean }> = [];
  public reenfileiramentos: ChamadaSendToQueue[] = [];
  public publicacoes: Array<{
    exchange: string;
    routingKey: string;
    content: Buffer;
    options?: Record<string, any>;
  }> = [];
  public waitForConfirmsChamado = 0;
  public fechado = false;

  async assertExchange(
    exchange: string,
    type: string,
    options?: Record<string, any>,
  ): Promise<unknown> {
    this.exchangesDeclaradas.push({ nome: exchange, tipo: type, options });
    return { exchange };
  }

  async assertQueue(queue: string, options?: Record<string, any>): Promise<unknown> {
    this.filasDeclaradas.push({ nome: queue, options });
    return { queue };
  }

  async bindQueue(queue: string, source: string, pattern: string): Promise<unknown> {
    this.bindingsDeclarados.push({ fila: queue, exchange: source, pattern });
    return {};
  }

  async prefetch(count: number): Promise<unknown> {
    this.prefetchConfigurado = count;
    return {};
  }

  async consume(
    queue: string,
    onMessage: (msg: MensagemAmqp | null) => void,
    options?: Record<string, any>,
  ): Promise<unknown> {
    this.handlersPorFila.set(queue, onMessage);
    this.opcoesConsumePorFila.set(queue, options ?? {});
    return { consumerTag: `ctag-${queue}` };
  }

  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Record<string, any>,
  ): boolean {
    this.publicacoes.push({ exchange, routingKey, content, options });
    return true;
  }

  sendToQueue(
    queue: string,
    content: Buffer,
    options?: Record<string, any>,
  ): boolean {
    this.reenfileiramentos.push({ queue, content, options: options ?? {} });
    return true;
  }

  ack(message: MensagemAmqp): void {
    this.acks.push(message);
  }

  nack(message: MensagemAmqp, allUpTo?: boolean, requeue?: boolean): void {
    this.nacks.push({ msg: message, allUpTo, requeue });
  }

  async waitForConfirms(): Promise<void> {
    this.waitForConfirmsChamado += 1;
  }

  async close(): Promise<void> {
    this.fechado = true;
  }

  async entregarMensagem(
    fila: string,
    conteudo: string | Buffer,
    opcoes?: {
      routingKey?: string;
      messageId?: string;
      type?: string;
      headers?: Record<string, any>;
    },
  ): Promise<MensagemAmqp> {
    const handler = this.handlersPorFila.get(fila);
    if (!handler) {
      throw new Error(`Nenhum consumidor registrado para a fila ${fila}`);
    }

    const msg: MensagemAmqp = {
      content: Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf-8'),
      fields: {
        routingKey: opcoes?.routingKey ?? '',
        exchange: EXCHANGE_EVENTOS,
        deliveryTag: 1,
        redelivered: false,
      },
      properties: {
        messageId: opcoes?.messageId,
        contentType: 'application/json',
        type: opcoes?.type,
        headers: opcoes?.headers ?? {},
      },
    };

    await handler(msg);
    return msg;
  }
}

describe('Mensageria RabbitMQ & Consumidor Idempotente (gestao-service)', () => {
  let canal: CanalAmqpSimulado;
  let repo: MemoriaGestaoRepository;
  let service: GestaoService;

  beforeEach(() => {
    canal = new CanalAmqpSimulado();
    repo = new MemoriaGestaoRepository();
    service = new GestaoService(repo);
  });

  it('deve declarar toda a topologia (exchanges, 5 filas principais, 5 DLQs e binding # em gestao.eventos)', async () => {
    await declararTopologiaRabbitMQ(canal);

    expect(canal.exchangesDeclaradas).toEqual([
      { nome: EXCHANGE_EVENTOS, tipo: 'topic', options: { durable: true, autoDelete: false } },
      { nome: EXCHANGE_DLX, tipo: 'direct', options: { durable: true, autoDelete: false } },
    ]);

    const nomesFilas = canal.filasDeclaradas.map((f) => f.nome);
    expect(nomesFilas).toContain('kds.item.lancado');
    expect(nomesFilas).toContain('kds.item.lancado.dlq');
    expect(nomesFilas).toContain('pdv.item.pronto');
    expect(nomesFilas).toContain('pdv.item.pronto.dlq');
    expect(nomesFilas).toContain('caixa.comanda.fechada');
    expect(nomesFilas).toContain('caixa.comanda.fechada.dlq');
    expect(nomesFilas).toContain('produtos.comanda.paga');
    expect(nomesFilas).toContain('produtos.comanda.paga.dlq');
    expect(nomesFilas).toContain('gestao.eventos');
    expect(nomesFilas).toContain('gestao.eventos.dlq');

    const filaGestao = canal.filasDeclaradas.find((f) => f.nome === FILAS.GESTAO_EVENTOS);
    expect(filaGestao?.options).toEqual({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGE_DLX,
        'x-dead-letter-routing-key': 'gestao.eventos.dlq',
      },
    });

    expect(canal.bindingsDeclarados).toContainEqual({
      fila: 'gestao.eventos',
      exchange: EXCHANGE_EVENTOS,
      pattern: '#',
    });
    expect(canal.bindingsDeclarados).toContainEqual({
      fila: 'gestao.eventos.dlq',
      exchange: EXCHANGE_DLX,
      pattern: 'gestao.eventos.dlq',
    });
  });

  it('deve validar mensageriaHabilitada e RABBITMQ_URL opcional no env', () => {
    expect(mensageriaHabilitada(undefined)).toBe(false);
    expect(mensageriaHabilitada('')).toBe(false);
    expect(mensageriaHabilitada('   ')).toBe(false);
    expect(mensageriaHabilitada('disabled')).toBe(false);
    expect(mensageriaHabilitada('DISABLED')).toBe(false);
    expect(mensageriaHabilitada('amqp://vaptpdv:secret@localhost:5672')).toBe(true);

    const envSemRabbit = validarEnv({ NODE_ENV: 'test', RABBITMQ_URL: '   ' });
    expect('RABBITMQ_URL' in envSemRabbit).toBe(false);

    const envComRabbit = validarEnv({
      NODE_ENV: 'test',
      RABBITMQ_URL: ' amqp://localhost:5672 ',
    });
    expect(envComRabbit.RABBITMQ_URL).toBe('amqp://localhost:5672');
  });

  it('deve conectar RabbitMQClient com fallback para createChannel, executar callbacks, publicar e reconectar no close', async () => {
    const emissorConexao1 = new EventEmitter() as EventEmitter & {
      createConfirmChannel: () => Promise<CanalAmqpSimulado>;
      createChannel: () => Promise<CanalAmqpSimulado>;
      close: () => Promise<void>;
    };
    const canal1 = new CanalAmqpSimulado();
    const canal2 = new CanalAmqpSimulado();
    let fechouConexao1 = false;

    emissorConexao1.createConfirmChannel = async () => {
      throw new Error('confirm channel indisponível');
    };
    emissorConexao1.createChannel = async () => canal1;
    emissorConexao1.close = async () => {
      fechouConexao1 = true;
    };

    const emissorConexao2 = new EventEmitter() as EventEmitter & {
      createConfirmChannel: () => Promise<CanalAmqpSimulado>;
      createChannel: () => Promise<CanalAmqpSimulado>;
      close: () => Promise<void>;
    };
    emissorConexao2.createConfirmChannel = async () => canal2;
    emissorConexao2.createChannel = async () => canal2;
    emissorConexao2.close = async () => undefined;

    let tentativas = 0;
    const conectarFn = vi.fn(async () => {
      tentativas += 1;
      return (tentativas === 1 ? emissorConexao1 : emissorConexao2) as any;
    });

    const client = new RabbitMQClient({
      url: 'amqp://localhost:5672',
      intervaloReconexaoInicialMs: 10,
      intervaloReconexaoMaxMs: 50,
      conectarFn,
    });

    const canaisRecebidos: CanalAmqp[] = [];
    client.registrarCallbackConexao((ch) => {
      canaisRecebidos.push(ch);
    });

    await client.conectar();
    expect(client.estaConectado()).toBe(true);
    expect(client.obterCanal()).toBe(canal1);
    expect(canaisRecebidos).toEqual([canal1]);

    await client.publicarEvento('comanda.paga', { evento_id: 'evt-pub-1', total: '10.00' });
    expect(canal1.publicacoes).toHaveLength(1);
    expect(canal1.publicacoes[0].routingKey).toBe('comanda.paga');
    expect(canal1.publicacoes[0].options?.persistent).toBe(true);
    expect(canal1.publicacoes[0].options?.messageId).toBe('evt-pub-1');
    expect(canal1.waitForConfirmsChamado).toBe(1);

    emissorConexao1.emit('close');
    expect(client.estaConectado()).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(conectarFn).toHaveBeenCalledTimes(2);
    expect(client.estaConectado()).toBe(true);
    expect(client.obterCanal()).toBe(canal2);
    expect(canaisRecebidos).toEqual([canal1, canal2]);

    await client.fechar();
    expect(client.estaConectado()).toBe(false);
    expect(canal2.fechado).toBe(true);
    expect(fechouConexao1).toBe(false);
  });

  it('deve configurar prefetch(10), noAck: false e confirmar ack manual apenas após processamento bem-sucedido', async () => {
    const spyProcessar = vi.spyOn(service, 'processarEvento');
    let acksDuranteExecucao = 0;

    spyProcessar.mockImplementationOnce(async (ev) => {
      acksDuranteExecucao = canal.acks.length;
      return {
        evento_id: ev.evento_id,
        evento: ev.evento,
        processado: true,
        duplicado: false,
        processado_em: new Date().toISOString(),
      };
    });

    await registrarConsumidorGestao(canal, service);

    expect(canal.prefetchConfigurado).toBe(10);
    expect(canal.opcoesConsumePorFila.get(FILAS.GESTAO_EVENTOS)).toEqual({ noAck: false });

    const msg = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        evento_id: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
        evento: 'comanda.paga',
        total: '71.17',
      }),
      { routingKey: 'comanda.paga' },
    );

    expect(acksDuranteExecucao).toBe(0);
    expect(canal.acks).toEqual([msg]);
    expect(canal.nacks).toHaveLength(0);
  });

  it('deve processar comanda.paga, comanda.cancelada, estoque.movimentado e aceitar item.lancado / item.pronto via # sem erro', async () => {
    await registrarConsumidorGestao(canal, service);

    const msgLancado = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
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
        categoria: 'Porções',
        setor: 'cozinha',
        preco_copiado: '34.90',
        quantidade: 1,
      }),
      { routingKey: 'item.lancado' },
    );
    expect(canal.acks).toContain(msgLancado);
    expect(await repo.eventoJaProcessado('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe(true);

    const msgPronto = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        evento_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        evento: 'item.pronto',
        versao: 1,
        ocorrido_em: '2026-11-22T20:08:12.000Z',
        ficha_id: 19,
        comanda_id: 12,
        item_comanda_id: 45,
        produto_id: 3,
        nome_produto: 'Porção de Batata com Cheddar',
        mesa: 6,
        setor: 'cozinha',
        status_preparo: 'pronto',
        pronto_em: '2026-11-22T20:08:12.000Z',
      }),
      { routingKey: 'item.pronto' },
    );
    expect(canal.acks).toContain(msgPronto);
    expect(await repo.eventoJaProcessado('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')).toBe(true);

    const msgPaga = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        evento_id: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
        evento: 'comanda.paga',
        versao: 1,
        ocorrido_em: '2026-11-22T20:50:30.000Z',
        comanda_id: 12,
        mesa: 6,
        garcom_id: 1,
        garcom_nome: 'Lucas',
        forma_pagamento: 'pix',
        subtotal: '64.70',
        taxa_servico: '6.47',
        total: '71.17',
        paga_em: '2026-11-22T20:50:30.000Z',
        itens: [
          {
            item_comanda_id: 44,
            produto_id: 1,
            nome_copiado: 'Chopp Pilsen 300ml',
            categoria: 'Bebidas',
            preco_copiado: '14.90',
            quantidade: 2,
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
        parcelas: [
          { forma_pagamento: 'dinheiro', valor_aplicado: '35.58' },
          { forma_pagamento: 'pix', valor_aplicado: '35.59' },
        ],
      }),
      { routingKey: 'comanda.paga' },
    );
    expect(canal.acks).toContain(msgPaga);

    const resumo = await service.obterResumoDiario('2026-11-22');
    expect(resumo.quantidade_pedidos).toBe(1);
    expect(resumo.total_vendas).toBe('71.17');
    expect(resumo.total_subtotal).toBe('64.70');
    expect(resumo.total_taxa_servico).toBe('6.47');
    expect(resumo.por_forma_pagamento.dinheiro).toBe('35.58');
    expect(resumo.por_forma_pagamento.pix).toBe('35.59');

    const ranking = await service.obterRankingProdutos();
    expect(ranking.receita_total_acumulada).toBe('64.70');
    expect(ranking.produtos).toHaveLength(2);

    const msgCancelada = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        evento_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
        evento: 'comanda.cancelada',
        versao: 1,
        ocorrido_em: '2026-11-22T20:15:00.000Z',
        comanda_id: 15,
        mesa: 9,
      }),
      { routingKey: 'comanda.cancelada' },
    );
    expect(canal.acks).toContain(msgCancelada);

    const relFat = await service.exportarRelatorio('faturamento', 'json', '2026-11-22', '2026-11-22');
    const linhasFat = relFat.dados as Array<{ comandas_canceladas: number; comandas_pagas: number }>;
    expect(linhasFat[0].comandas_pagas).toBe(1);
    expect(linhasFat[0].comandas_canceladas).toBe(1);

    const msgEstoque = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        evento_id: 'c56a4180-65aa-42ec-a945-5fd21dec0538',
        evento: 'estoque.movimentado',
        versao: 1,
        ocorrido_em: '2026-11-22T20:50:31.000Z',
        produto_id: 1,
        nome_produto: 'Chopp Pilsen 300ml',
        categoria: 'Bebidas',
        tipo: 'saida',
        quantidade: -2,
        estoque_atual: 8,
        estoque_minimo: 10,
        abaixo_do_minimo: true,
      }),
      { routingKey: 'estoque.movimentado' },
    );
    expect(canal.acks).toContain(msgEstoque);

    const alertas = await service.obterAlertasEstoque();
    expect(alertas.alertas).toHaveLength(1);
    expect(alertas.alertas[0].produto_id).toBe(1);
    expect(alertas.alertas[0].nivel).toBe('baixo');
    expect(canal.nacks).toHaveLength(0);
  });

  it('deve garantir idempotência na reentrega de comanda.paga sem duplicar faturamento nem Curva ABC, confirmando ack', async () => {
    await registrarConsumidorGestao(canal, service);

    const eventoId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const payload = JSON.stringify({
      evento_id: eventoId,
      evento: 'comanda.paga',
      ocorrido_em: '2026-11-22T21:00:00.000Z',
      paga_em: '2026-11-22T21:00:00.000Z',
      forma_pagamento: 'cartao',
      subtotal: '100.00',
      taxa_servico: '10.00',
      total: '110.00',
      garcom_id: 4,
      garcom_nome: 'Ana Garçom',
      itens: [
        {
          produto_id: 7,
          nome: 'Burger Artesanal',
          categoria: 'Lanches',
          quantidade: 2,
          subtotal: '100.00',
        },
      ],
    });

    const msg1 = await canal.entregarMensagem(FILAS.GESTAO_EVENTOS, payload, {
      routingKey: 'comanda.paga',
    });
    const msg2 = await canal.entregarMensagem(FILAS.GESTAO_EVENTOS, payload, {
      routingKey: 'comanda.paga',
    });

    expect(canal.acks).toEqual([msg1, msg2]);
    expect(canal.nacks).toHaveLength(0);

    const resumo = await service.obterResumoDiario('2026-11-22');
    expect(resumo.quantidade_pedidos).toBe(1);
    expect(resumo.total_vendas).toBe('110.00');
    expect(resumo.por_forma_pagamento.cartao).toBe('110.00');

    const ranking = await service.obterRankingProdutos();
    expect(ranking.receita_total_acumulada).toBe('100.00');
    expect(ranking.produtos[0].quantidade_vendida).toBe(2);
    expect(ranking.produtos[0].receita_gerada).toBe('100.00');
  });

  it('deve aplicar retry com x-retry-count 1 e 2 em erro de repositório e enviar para gestao.eventos.dlq na 3ª falha; JSON inválido vai direto para .dlq', async () => {
    const erroBanco = new Error('Falha transitória no PostgreSQL');
    vi.spyOn(repo, 'processarComandaPaga').mockRejectedValue(erroBanco);

    await registrarConsumidorGestao(canal, service);

    const eventoId = '11111111-1111-4111-8111-111111111111';
    const payload = JSON.stringify({
      evento_id: eventoId,
      evento: 'comanda.paga',
      ocorrido_em: '2026-11-22T22:00:00.000Z',
      subtotal: '50.00',
      taxa_servico: '5.00',
      total: '55.00',
      forma_pagamento: 'pix',
      itens: [],
    });

    const tentativa1 = await canal.entregarMensagem(FILAS.GESTAO_EVENTOS, payload, {
      routingKey: 'comanda.paga',
      headers: { origem: 'caixa-service' },
    });

    expect(canal.reenfileiramentos).toHaveLength(1);
    expect(canal.reenfileiramentos[0].queue).toBe(FILAS.GESTAO_EVENTOS);
    expect(canal.reenfileiramentos[0].options.headers).toEqual({
      origem: 'caixa-service',
      'x-retry-count': 1,
    });
    expect(canal.acks).toContain(tentativa1);
    expect(canal.nacks).toHaveLength(0);
    expect(await repo.eventoJaProcessado(eventoId)).toBe(false);

    const tentativa2 = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      canal.reenfileiramentos[0].content,
      {
        routingKey: 'comanda.paga',
        headers: canal.reenfileiramentos[0].options.headers,
      },
    );

    expect(canal.reenfileiramentos).toHaveLength(2);
    expect(canal.reenfileiramentos[1].options.headers).toEqual({
      origem: 'caixa-service',
      'x-retry-count': 2,
    });
    expect(canal.acks).toContain(tentativa2);
    expect(canal.nacks).toHaveLength(0);
    expect(await repo.eventoJaProcessado(eventoId)).toBe(false);

    const tentativa3 = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      canal.reenfileiramentos[1].content,
      {
        routingKey: 'comanda.paga',
        headers: canal.reenfileiramentos[1].options.headers,
      },
    );

    expect(canal.reenfileiramentos).toHaveLength(2);
    expect(canal.nacks).toHaveLength(1);
    expect(canal.nacks[0]).toEqual({
      msg: tentativa3,
      allUpTo: false,
      requeue: false,
    });
    expect(await repo.eventoJaProcessado(eventoId)).toBe(false);

    const msgCorrompida = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      '{json-corrompido',
      { routingKey: 'comanda.paga' },
    );

    expect(canal.reenfileiramentos).toHaveLength(2);
    expect(canal.nacks).toHaveLength(2);
    expect(canal.nacks[1]).toEqual({
      msg: msgCorrompida,
      allUpTo: false,
      requeue: false,
    });

    const msgSemId = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({ evento: 'comanda.paga' }),
      { routingKey: 'comanda.paga' },
    );

    expect(canal.reenfileiramentos).toHaveLength(2);
    expect(canal.nacks).toHaveLength(3);
    expect(canal.nacks[2]).toEqual({
      msg: msgSemId,
      allUpTo: false,
      requeue: false,
    });
  });

  it('deve preencher evento_id e evento via fallback de meta (messageId / routingKey) e falhar se evento estiver ausente', async () => {
    await registrarConsumidorGestao(canal, service);

    const msgFallback = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({
        ocorrido_em: '2026-11-22T23:00:00.000Z',
        comanda_id: 99,
      }),
      {
        messageId: '22222222-2222-4222-8222-222222222222',
        routingKey: 'comanda.cancelada',
      },
    );

    expect(canal.acks).toContain(msgFallback);
    expect(await repo.eventoJaProcessado('22222222-2222-4222-8222-222222222222')).toBe(true);

    const msgSemEvento = await canal.entregarMensagem(
      FILAS.GESTAO_EVENTOS,
      JSON.stringify({ evento_id: '33333333-3333-4333-8333-333333333333' }),
      { routingKey: '' },
    );
    expect(canal.reenfileiramentos).toHaveLength(1);
    expect(canal.acks).toContain(msgSemEvento);
  });
});
