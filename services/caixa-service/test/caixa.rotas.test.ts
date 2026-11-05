import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { MemoriaCobrancasRepository } from './helpers/memoria.repository';
import { CobrancasService } from '../src/modules/caixa/cobrancas.service';

describe('Rotas HTTP caixa-service — Fila de Contas, Fechamento e Split Payment (Stories 15.2 & 15.3)', () => {
  let app: FastifyInstance;
  let repository: MemoriaCobrancasRepository;
  let service: CobrancasService;

  beforeEach(async () => {
    repository = new MemoriaCobrancasRepository();
    service = new CobrancasService(repository);
    app = await buildApp({
      repository,
      service,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /caixa/comandas/:comandaId/fechar (Story 15.2)', () => {
    it('deve sincronizar comanda com taxa opcional de 10% aplicada e ROUND_HALF_UP (RN12)', async () => {
      const payload = {
        mesa: 12,
        garcom_id: 1,
        garcom_nome: 'Carlos Garçom',
        nome_cliente: 'Cliente VIP',
        aplicar_taxa_servico: true,
        itens: [
          {
            item_comanda_id: 101,
            produto_id: 7,
            nome: 'Hambúrguer Artesanal',
            preco_unitario: '29.90',
            quantidade: 2,
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/fechar',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.comanda_id).toBe(42);
      expect(corpo.mesa).toBe(12);
      expect(corpo.garcom_id).toBe(1);
      expect(corpo.status).toBe('aguardando_pagamento');
      expect(corpo.aplicar_taxa_servico).toBe(true);
      expect(corpo.subtotal).toBe('59.80');
      // 59.80 * 0.10 = 5.98
      expect(corpo.taxa_servico).toBe('5.98');
      expect(corpo.total).toBe('65.78');
      expect(corpo.saldo_restante).toBe('65.78');
      expect(corpo.valor_pago).toBe('0.00');
      expect(corpo.itens).toHaveLength(1);
      expect(corpo.itens[0].subtotal).toBe('59.80');
    });

    it('deve sincronizar fechamento inicial sem taxa de serviço (aplicar_taxa_servico: false)', async () => {
      const payload = {
        mesa: 5,
        garcom_id: 2,
        aplicar_taxa_servico: false,
        itens: [
          {
            item_comanda_id: 201,
            produto_id: 3,
            nome: 'Pizza Margherita',
            preco_unitario: '50.00',
            quantidade: 1,
          },
        ],
      };

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/50/fechar',
        payload,
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.subtotal).toBe('50.00');
      expect(corpo.taxa_servico).toBe('0.00');
      expect(corpo.total).toBe('50.00');
      expect(corpo.saldo_restante).toBe('50.00');
    });

    it('deve recalcular taxa e saldo de comanda existente via toggle de taxa de serviço (C05, C06)', async () => {
      // 1. Criar inicial com taxa (subtotal: 100.00, taxa: 10.00, total: 110.00)
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/60/fechar',
        payload: {
          mesa: 8,
          garcom_id: 1,
          aplicar_taxa_servico: true,
          itens: [
            {
              item_comanda_id: 301,
              produto_id: 15,
              nome: 'Combo Premium',
              preco_unitario: '100.00',
              quantidade: 1,
            },
          ],
        },
      });

      // 2. Operador desmarca taxa de serviço no Caixa (aplicar_taxa_servico: false)
      const resToggleOff = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/60/fechar',
        payload: {
          aplicar_taxa_servico: false,
        },
      });

      expect(resToggleOff.statusCode).toBe(200);
      const corpoOff = resToggleOff.json();
      expect(corpoOff.aplicar_taxa_servico).toBe(false);
      expect(corpoOff.subtotal).toBe('100.00');
      expect(corpoOff.taxa_servico).toBe('0.00');
      expect(corpoOff.total).toBe('100.00');
      expect(corpoOff.saldo_restante).toBe('100.00');

      // 3. Operador remarca a taxa de serviço
      const resToggleOn = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/60/fechar',
        payload: {
          aplicar_taxa_servico: true,
        },
      });

      expect(resToggleOn.statusCode).toBe(200);
      const corpoOn = resToggleOn.json();
      expect(corpoOn.aplicar_taxa_servico).toBe(true);
      expect(corpoOn.taxa_servico).toBe('10.00');
      expect(corpoOn.total).toBe('110.00');
      expect(corpoOn.saldo_restante).toBe('110.00');
    });

    it('deve retornar 409 COMANDA_IMUTAVEL se a comanda já estiver quitada', async () => {
      // Inserir comanda já paga
      await repository.criar({
        comandaId: 70,
        mesa: 2,
        garcomId: 1,
        status: 'paga',
        aplicarTaxaServico: true,
        subtotal: new Prisma.Decimal('50.00'),
        taxaServico: new Prisma.Decimal('5.00'),
        total: new Prisma.Decimal('55.00'),
        valorPago: new Prisma.Decimal('55.00'),
        saldoRestante: new Prisma.Decimal('0.00'),
        itensSnapshot: [],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/70/fechar',
        payload: {
          aplicar_taxa_servico: false,
        },
      });

      expect(res.statusCode).toBe(409);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('COMANDA_IMUTAVEL');
    });

    it('deve retornar 400 se faltar mesa ou itens no fechamento inicial de comanda inexistente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/88/fechar',
        payload: {
          itens: [],
        },
      });

      expect(res.statusCode).toBe(400);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
    });
  });

  describe('GET /caixa/comandas/:comandaId (Story 15.2)', () => {
    it('deve retornar detalhe completo da cobrança existente', async () => {
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/fechar',
        payload: {
          mesa: 12,
          garcom_id: 1,
          nome_cliente: 'Mariana',
          itens: [
            {
              item_comanda_id: 101,
              produto_id: 7,
              nome: 'Hambúrguer',
              preco_unitario: '25.00',
              quantidade: 2,
            },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas/42',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.comanda_id).toBe(42);
      expect(corpo.mesa).toBe(12);
      expect(corpo.nome_cliente).toBe('Mariana');
      expect(corpo.subtotal).toBe('50.00');
      expect(corpo.taxa_servico).toBe('5.00');
      expect(corpo.total).toBe('55.00');
      expect(corpo.saldo_restante).toBe('55.00');
      expect(corpo.itens).toHaveLength(1);
      expect(corpo.parcelas).toBeInstanceOf(Array);
    });

    it('deve retornar 404 NOT_FOUND se cobrança da comanda não existir', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas/9999',
      });

      expect(res.statusCode).toBe(404);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('GET /caixa/comandas — Fila do Caixa e Resumo do Turno (Story 15.2, C01/C02/C15)', () => {
    beforeEach(async () => {
      // Criar 2 comandas aguardando pagamento
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/10/fechar',
        payload: {
          mesa: 1,
          garcom_id: 1,
          nome_cliente: 'Ana',
          itens: [{ item_comanda_id: 1, produto_id: 1, nome: 'Item 1', preco_unitario: '40.00', quantidade: 1 }],
        },
      });

      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/20/fechar',
        payload: {
          mesa: 2,
          garcom_id: 2,
          nome_cliente: 'Bruno',
          itens: [{ item_comanda_id: 2, produto_id: 2, nome: 'Item 2', preco_unitario: '60.00', quantidade: 1 }],
        },
      });

      // Criar 1 comanda paga hoje no repositório
      await repository.criar({
        comandaId: 30,
        mesa: 3,
        garcomId: 1,
        status: 'paga',
        aplicarTaxaServico: true,
        subtotal: new Prisma.Decimal('100.00'),
        taxaServico: new Prisma.Decimal('10.00'),
        total: new Prisma.Decimal('110.00'),
        valorPago: new Prisma.Decimal('110.00'),
        saldoRestante: new Prisma.Decimal('0.00'),
        itensSnapshot: [],
        pagaEm: new Date(),
      });
    });

    it('deve listar comandas com resumo do turno no envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.comandas).toHaveLength(3);
      expect(corpo.resumo_turno.aguardando_pagamento).toBe(2);
      expect(corpo.resumo_turno.pagas_hoje).toBe(1);
      expect(corpo.resumo_turno.faturamento_turno).toBe('110.00');

      // Cabeçalho / envelope direto
      expect(corpo.aguardando_pagamento).toBe(2);
      expect(corpo.pagas_hoje).toBe(1);
      expect(corpo.faturamento_turno).toBe('110.00');
    });

    it('deve filtrar comandas por status (aguardando_pagamento / fechada)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas?status=fechada',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.comandas).toHaveLength(2);
      for (const comanda of corpo.comandas) {
        expect(comanda.status).toBe('aguardando_pagamento');
      }
    });

    it('deve filtrar comandas por mesa', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas?mesa=2',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.comandas).toHaveLength(1);
      expect(corpo.comandas[0].comanda_id).toBe(20);
    });

    it('deve filtrar comandas por termo de busca', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/comandas?busca=Ana',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.comandas).toHaveLength(1);
      expect(corpo.comandas[0].comanda_id).toBe(10);
    });
  });

  describe('POST /caixa/comandas/:comandaId/dividir — Split Payment (Story 15.3, C11/RN19)', () => {
    beforeEach(async () => {
      // Comanda de teste: Subtotal 59.80, Taxa 5.98, Total 65.78
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/fechar',
        payload: {
          mesa: 12,
          garcom_id: 1,
          aplicar_taxa_servico: true,
          itens: [
            {
              item_comanda_id: 101,
              produto_id: 7,
              nome: 'Hambúrguer Artesanal',
              preco_unitario: '29.90',
              quantidade: 2,
            },
          ],
        },
      });
    });

    it('deve dividir por 3 pessoas com conservação estrita de centavos [21.93, 21.93, 21.92] (C11, RN19)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/dividir',
        payload: {
          modo: 'pessoas',
          pessoas: 3,
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.comanda_id).toBe(42);
      expect(corpo.mesa).toBe(12);
      expect(corpo.modo).toBe('pessoas');
      expect(corpo.pessoas).toBe(3);
      expect(corpo.total_comanda).toBe('65.78');
      expect(corpo.saldo_a_dividir).toBe('65.78');
      expect(corpo.cotas).toHaveLength(3);

      const cota1 = new Prisma.Decimal(corpo.cotas[0].valor);
      const cota2 = new Prisma.Decimal(corpo.cotas[1].valor);
      const cota3 = new Prisma.Decimal(corpo.cotas[2].valor);

      const soma = cota1.add(cota2).add(cota3);
      expect(soma.toFixed(2)).toBe('65.78');

      // Verifica se detalhes foram persistidos
      const detalheRes = await app.inject({
        method: 'GET',
        url: '/caixa/comandas/42',
      });
      const detalheCorpo = detalheRes.json();
      expect(detalheCorpo.modo_divisao).toBe('pessoas');
      expect(detalheCorpo.pessoas_divisao).toBe(3);
      expect(detalheCorpo.divisao_detalhes).toBeDefined();
    });

    it('deve aceitar quantidade_pessoas como alias de pessoas no payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/dividir',
        payload: {
          modo: 'pessoas',
          quantidade_pessoas: 2,
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.cotas).toHaveLength(2);
      // 65.78 / 2 = 32.89 cada
      expect(corpo.cotas[0].valor).toBe('32.89');
      expect(corpo.cotas[1].valor).toBe('32.89');
    });

    it('deve dividir por itens selecionados proporcionalmente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/dividir',
        payload: {
          modo: 'itens',
          cotas: [
            {
              rotulo: 'Cliente A',
              itens: [{ item_comanda_id: 101, quantidade: 1 }],
            },
            {
              rotulo: 'Cliente B',
              itens: [{ item_comanda_id: 101, quantidade: 1 }],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.modo).toBe('itens');
      expect(corpo.pessoas).toBe(2);
      expect(corpo.cotas).toHaveLength(2);

      // Cada um paga 1 hambúrguer (29.90 + 10% = 32.89)
      expect(corpo.cotas[0].valor).toBe('32.89');
      expect(corpo.cotas[1].valor).toBe('32.89');

      const soma = new Prisma.Decimal(corpo.cotas[0].valor).add(
        new Prisma.Decimal(corpo.cotas[1].valor),
      );
      expect(soma.toFixed(2)).toBe('65.78');
    });

    it('deve retornar 404 NOT_FOUND se tentar dividir comanda inexistente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/9999/dividir',
        payload: {
          modo: 'pessoas',
          pessoas: 2,
        },
      });

      expect(res.statusCode).toBe(404);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    });

    it('deve retornar 422 DIVISAO_INVALIDA se quantidade de pessoas for menor que 2', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/dividir',
        payload: {
          modo: 'pessoas',
          pessoas: 1,
        },
      });

      expect(res.statusCode).toBe(422);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('DIVISAO_INVALIDA');
    });

    it('deve retornar 409 COMANDA_IMUTAVEL se a comanda já estiver quitada', async () => {
      await repository.criar({
        comandaId: 99,
        mesa: 1,
        garcomId: 1,
        status: 'paga',
        aplicarTaxaServico: true,
        subtotal: new Prisma.Decimal('50.00'),
        taxaServico: new Prisma.Decimal('5.00'),
        total: new Prisma.Decimal('55.00'),
        valorPago: new Prisma.Decimal('55.00'),
        saldoRestante: new Prisma.Decimal('0.00'),
        itensSnapshot: [],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/99/dividir',
        payload: {
          modo: 'pessoas',
          pessoas: 2,
        },
      });

      expect(res.statusCode).toBe(409);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('COMANDA_IMUTAVEL');
    });
  });
});
