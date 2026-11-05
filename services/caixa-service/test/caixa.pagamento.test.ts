import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoriaCobrancasRepository } from './helpers/memoria.repository';
import { CobrancasService } from '../src/modules/caixa/cobrancas.service';
import { EstoqueCoreGateway, GestaoGateway } from '../src/modules/caixa/gateways';
import { ErroDominio } from '../src/shared/erros';

describe('Story 15.4 — Quitação de Parcelas/Integral, Cálculo de Troco em Dinheiro e Baixa Atômica de Estoque no Core', () => {
  let app: FastifyInstance;
  let repository: MemoriaCobrancasRepository;
  let service: CobrancasService;
  let mockEstoqueGateway: EstoqueCoreGateway;
  let mockGestaoGateway: GestaoGateway;
  let chamadasBaixaEstoque: Array<{ comandaId: number; itens: any[] }>;
  let chamadasGestaoEventos: Array<Record<string, unknown>>;

  beforeEach(async () => {
    chamadasBaixaEstoque = [];
    chamadasGestaoEventos = [];

    mockEstoqueGateway = {
      baixarEstoque: vi.fn(async (comandaId: number, itens: any[]) => {
        chamadasBaixaEstoque.push({ comandaId, itens });
      }),
    };

    mockGestaoGateway = {
      notificarComandaPaga: vi.fn(async (evento: Record<string, unknown>) => {
        chamadasGestaoEventos.push(evento);
      }),
    };

    repository = new MemoriaCobrancasRepository();
    service = new CobrancasService(repository, mockEstoqueGateway, mockGestaoGateway);

    app = await buildApp({
      repository,
      service,
      estoqueGateway: mockEstoqueGateway,
      gestaoGateway: mockGestaoGateway,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function fecharComandaPadrao(comandaId = 42, mesa = 12) {
    const res = await app.inject({
      method: 'POST',
      url: `/caixa/comandas/${comandaId}/fechar`,
      payload: {
        mesa,
        garcom_id: 1,
        garcom_nome: 'Carlos Garçom',
        nome_cliente: 'Cliente Teste',
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
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  describe('Quitação Integral e Cálculo de Troco em Dinheiro (RN15, RN19)', () => {
    it('deve quitar integralmente em dinheiro, calculando troco exato em Decimal e gerando recibo', async () => {
      await fecharComandaPadrao(42, 12);
      // subtotal 59.80 + 5.98 (10%) = total 65.78

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/42/pagar',
        payload: {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '65.78',
          valor_recebido: '100.00',
          pagador_label: 'Carlos Cliente',
          operador_nome: 'Ana Caixa',
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.comanda_id).toBe(42);
      expect(corpo.status).toBe('paga');
      expect(corpo.valor_pago).toBe('65.78');
      expect(corpo.saldo_restante).toBe('0.00');
      // 100.00 - 65.78 = 34.22
      expect(corpo.troco_total).toBe('34.22');

      expect(corpo.parcela_registrada).toBeDefined();
      expect(corpo.parcela_registrada.forma_pagamento).toBe('dinheiro');
      expect(corpo.parcela_registrada.valor_aplicado).toBe('65.78');
      expect(corpo.parcela_registrada.valor_recebido).toBe('100.00');
      expect(corpo.parcela_registrada.troco).toBe('34.22');

      expect(corpo.recibo).toBeDefined();
      expect(corpo.recibo.codigo_autenticacao).toMatch(/^VAPT-\d{8}-M12-[A-F0-9]{4}$/);

      // Baixa no Core foi acionada
      expect(chamadasBaixaEstoque).toHaveLength(1);
      expect(chamadasBaixaEstoque[0].comandaId).toBe(42);
      expect(chamadasBaixaEstoque[0].itens).toEqual([{ produto_id: 7, quantidade: 2 }]);

      // Notificação ao gestao-service foi disparada
      expect(chamadasGestaoEventos).toHaveLength(1);
      expect(chamadasGestaoEventos[0].evento).toBe('comanda.paga');
      expect(chamadasGestaoEventos[0].comanda_id).toBe(42);
      expect(chamadasGestaoEventos[0].troco).toBe('34.22');
    });

    it('deve quitar em dinheiro com valor exato (troco = 0.00)', async () => {
      await fecharComandaPadrao(43, 10);

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/43/pagar',
        payload: {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '65.78',
          valor_recebido: '65.78',
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.status).toBe('paga');
      expect(corpo.troco_total).toBe('0.00');
      expect(corpo.parcela_registrada.troco).toBe('0.00');
    });

    it('deve assumir quitação total do saldo_restante quando valor_aplicado for omitido', async () => {
      await fecharComandaPadrao(44, 8);

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/44/pagar',
        payload: {
          forma_pagamento: 'pix',
        },
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      expect(corpo.status).toBe('paga');
      expect(corpo.valor_pago).toBe('65.78');
      expect(corpo.saldo_restante).toBe('0.00');
      expect(corpo.parcela_registrada.valor_aplicado).toBe('65.78');
      expect(corpo.parcela_registrada.troco).toBe('0.00');
    });

    it('deve rejeitar com 400 VALIDACAO se valor_recebido for menor que valor_aplicado em dinheiro (RN19 CA1)', async () => {
      await fecharComandaPadrao(45, 5);

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/45/pagar',
        payload: {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '60.00',
          valor_recebido: '50.00',
        },
      });

      expect(res.statusCode).toBe(400);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.mensagem).toContain('Valor recebido não pode ser menor que o valor aplicado');
    });

    it('deve quitar via PIX e via Cartão com troco zero', async () => {
      await fecharComandaPadrao(46, 2);

      const resPix = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/46/pagar',
        payload: {
          forma_pagamento: 'pix',
          valor_aplicado: '65.78',
        },
      });

      expect(resPix.statusCode).toBe(200);
      expect(resPix.json().status).toBe('paga');
      expect(resPix.json().troco_total).toBe('0.00');
    });
  });

  describe('Quitação Parcelada / Multi-Parcelas (Split Payment — Story 15.4)', () => {
    it('deve abater saldo_restante gradualmente e só quitar quando saldo zerar', async () => {
      await fecharComandaPadrao(50, 7);
      // Total: 65.78

      // Parcela 1: 35.00 no Cartão
      const res1 = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/50/pagar',
        payload: {
          forma_pagamento: 'cartao',
          valor_aplicado: '35.00',
          pagador_label: 'Pessoa 1 de 2',
        },
      });

      expect(res1.statusCode).toBe(200);
      const corpo1 = res1.json();
      expect(corpo1.status).toBe('parcialmente_paga');
      expect(corpo1.valor_pago).toBe('35.00');
      // 65.78 - 35.00 = 30.78
      expect(corpo1.saldo_restante).toBe('30.78');
      expect(corpo1.recibo).toBeNull();
      // Não aciona baixa de estoque antes de quitar
      expect(chamadasBaixaEstoque).toHaveLength(0);

      // Consulta no Caixa exibe status parcialmente_paga
      const resConsulta = await app.inject({
        method: 'GET',
        url: '/caixa/comandas/50',
      });
      expect(resConsulta.statusCode).toBe(200);
      expect(resConsulta.json().status).toBe('parcialmente_paga');
      expect(resConsulta.json().saldo_restante).toBe('30.78');
      expect(resConsulta.json().parcelas).toHaveLength(1);

      // Parcela 2: restante 30.78 em Dinheiro (entregou 40.00 -> troco 9.22)
      const res2 = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/50/pagar',
        payload: {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '30.78',
          valor_recebido: '40.00',
          pagador_label: 'Pessoa 2 de 2',
        },
      });

      expect(res2.statusCode).toBe(200);
      const corpo2 = res2.json();
      expect(corpo2.status).toBe('paga');
      expect(corpo2.valor_pago).toBe('65.78');
      expect(corpo2.saldo_restante).toBe('0.00');
      expect(corpo2.troco_total).toBe('9.22');
      expect(corpo2.recibo).toBeDefined();

      // Agora a baixa no Core foi acionada
      expect(chamadasBaixaEstoque).toHaveLength(1);
    });

    it('deve rejeitar com 422 VALOR_PAGAMENTO_INVALIDO se valor do pagamento exceder o saldo restante', async () => {
      await fecharComandaPadrao(51, 9);

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/51/pagar',
        payload: {
          forma_pagamento: 'pix',
          valor_aplicado: '70.00', // Total é 65.78
        },
      });

      expect(res.statusCode).toBe(422);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('VALOR_PAGAMENTO_INVALIDO');
    });

    it('deve rejeitar com 422 VALOR_PAGAMENTO_INVALIDO se valor for menor ou igual a zero', async () => {
      await fecharComandaPadrao(52, 11);

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/52/pagar',
        payload: {
          forma_pagamento: 'pix',
          valor_aplicado: '0.00',
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().erro.codigo).toBe('VALOR_PAGAMENTO_INVALIDO');
    });

    it('deve rejeitar com 409 COMANDA_IMUTAVEL tentativa de pagar comanda já liquidada', async () => {
      await fecharComandaPadrao(53, 14);

      // Quita comanda
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/53/pagar',
        payload: { forma_pagamento: 'pix' },
      });

      // Tentativa de novo pagamento
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/53/pagar',
        payload: { forma_pagamento: 'dinheiro', valor_aplicado: '10.00' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().erro.codigo).toBe('COMANDA_IMUTAVEL');
    });

    it('deve retornar 404 NAO_ENCONTRADO para comanda inexistente', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/9999/pagar',
        payload: { forma_pagamento: 'pix' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
    });
  });

  describe('Resiliência e Fail-Fast com o Core (ADR-07)', () => {
    it('deve abortar a transação e retornar 503 SERVICO_INDISPONIVEL com { servico: "vapt-pdv-core" } se o Core falhar com erro interno (500)', async () => {
      await fecharComandaPadrao(60, 15);

      // Simula falha interna no Core ao baixar estoque
      mockEstoqueGateway.baixarEstoque = vi.fn().mockRejectedValue(
        ErroDominio.servicoIndisponivel('vapt-pdv-core', 'Core retornou status HTTP 500 durante baixa de estoque.'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/60/pagar',
        payload: {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '65.78',
          valor_recebido: '70.00',
        },
      });

      expect(res.statusCode).toBe(503);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('SERVICO_INDISPONIVEL');
      expect(corpo.erro.detalhes.servico).toBe('vapt-pdv-core');

      // Verifica que a venda NÃO foi liquidada e o saldo continua intacto
      const comandaNoBanco = await repository.buscarPorComandaId(60);
      expect(comandaNoBanco?.status).toBe('aguardando_pagamento');
      expect(comandaNoBanco?.saldoRestante.toFixed(2)).toBe('65.78');
      expect(comandaNoBanco?.valorPago.toFixed(2)).toBe('0.00');
      expect(comandaNoBanco?.pagamentos).toHaveLength(0);
    });

    it('deve abortar a transação e retornar 503 se o Core der timeout ou ECONNREFUSED', async () => {
      await fecharComandaPadrao(61, 16);

      // Simula Timeout / ECONNREFUSED no Core
      mockEstoqueGateway.baixarEstoque = vi.fn().mockRejectedValue(
        ErroDominio.servicoIndisponivel('vapt-pdv-core', 'Falha ao conectar com o Core: fetch failed (ECONNREFUSED)'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/61/pagar',
        payload: {
          forma_pagamento: 'pix',
        },
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().erro.codigo).toBe('SERVICO_INDISPONIVEL');
      expect(res.json().erro.detalhes.servico).toBe('vapt-pdv-core');

      // Verifica que não houve venda órfã
      const comandaNoBanco = await repository.buscarPorComandaId(61);
      expect(comandaNoBanco?.status).toBe('aguardando_pagamento');
      expect(comandaNoBanco?.saldoRestante.toFixed(2)).toBe('65.78');
    });

    it('deve abortar a transação com 409 CONFLITO se o Core reportar estoque insuficiente', async () => {
      await fecharComandaPadrao(62, 17);

      mockEstoqueGateway.baixarEstoque = vi.fn().mockRejectedValue(
        ErroDominio.conflito('Estoque insuficiente para o produto 7.', { produto_id: 7 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/62/pagar',
        payload: {
          forma_pagamento: 'cartao',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().erro.codigo).toBe('CONFLITO');

      const comandaNoBanco = await repository.buscarPorComandaId(62);
      expect(comandaNoBanco?.status).toBe('aguardando_pagamento');
    });
  });

  describe('Notificação Assíncrona e Graciosa ao gestao-service (Story 15.4)', () => {
    it('deve concluir a venda com 200 OK mesmo que a notificação ao gestao-service falhe (degradação graciosa)', async () => {
      await fecharComandaPadrao(70, 20);

      // Simula falha ou timeout no gestao-service
      mockGestaoGateway.notificarComandaPaga = vi.fn().mockRejectedValue(new Error('gestao-service fora do ar'));

      const res = await app.inject({
        method: 'POST',
        url: '/caixa/comandas/70/pagar',
        payload: {
          forma_pagamento: 'pix',
        },
      });

      // A quitação NÃO deve ser abortada
      expect(res.statusCode).toBe(200);
      const corpo = res.json();
      expect(corpo.status).toBe('paga');
      expect(corpo.recibo).toBeDefined();

      const comandaNoBanco = await repository.buscarPorComandaId(70);
      expect(comandaNoBanco?.status).toBe('paga');
    });
  });
});
