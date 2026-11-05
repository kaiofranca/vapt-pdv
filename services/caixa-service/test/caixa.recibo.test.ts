import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoriaCobrancasRepository } from './helpers/memoria.repository';
import { CobrancasService } from '../src/modules/caixa/cobrancas.service';
import { EstoqueCoreGateway, GestaoGateway } from '../src/modules/caixa/gateways';

describe('Story 15.5 — Emissão e Consulta do Recibo Operacional Térmico .paper (C12) com Código Único', () => {
  let app: FastifyInstance;
  let repository: MemoriaCobrancasRepository;
  let service: CobrancasService;
  let mockEstoqueGateway: EstoqueCoreGateway;
  let mockGestaoGateway: GestaoGateway;

  beforeEach(async () => {
    mockEstoqueGateway = {
      baixarEstoque: vi.fn(async () => {}),
    };
    mockGestaoGateway = {
      notificarComandaPaga: vi.fn(async () => {}),
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

  async function fecharEQuitarComanda(comandaId = 42, mesa = 12) {
    // 1. Fechar comanda
    await app.inject({
      method: 'POST',
      url: `/caixa/comandas/${comandaId}/fechar`,
      payload: {
        mesa,
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
          {
            item_comanda_id: 102,
            produto_id: 12,
            nome: 'Refrigerante Lata',
            preco_unitario: '7.00',
            quantidade: 1,
          },
        ],
      },
    });

    // 2. Quitar comanda com pagamento em dinheiro e troco
    // Subtotal: (29.90 * 2) + 7.00 = 66.80
    // Taxa de serviço 10%: 6.68
    // Total: 73.48
    const resPagar = await app.inject({
      method: 'POST',
      url: `/caixa/comandas/${comandaId}/pagar`,
      payload: {
        forma_pagamento: 'dinheiro',
        valor_aplicado: '73.48',
        valor_recebido: '100.00',
        pagador_label: 'Cliente VIP',
        operador_nome: 'Ana Caixa',
      },
    });

    expect(resPagar.statusCode).toBe(200);
    return resPagar.json();
  }

  describe('GET /caixa/recibos/:comandaId', () => {
    it('deve retornar 404 NAO_ENCONTRADO se a comanda não existir', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/9999',
      });

      expect(res.statusCode).toBe(404);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    });

    it('deve retornar 404 NAO_ENCONTRADO se a comanda existir mas não estiver totalmente quitada (status aguardando_pagamento)', async () => {
      // Cria cobrança fechada mas não paga
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/100/fechar',
        payload: {
          mesa: 5,
          garcom_id: 2,
          itens: [
            {
              item_comanda_id: 1,
              produto_id: 1,
              nome: 'Cerveja',
              preco_unitario: '10.00',
              quantidade: 1,
            },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/100',
      });

      expect(res.statusCode).toBe(404);
      const corpo = res.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');
      expect(corpo.erro.mensagem).toContain('ainda não foi totalmente liquidada');
    });

    it('deve retornar 404 NAO_ENCONTRADO se a comanda for apenas parcialmente paga', async () => {
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/101/fechar',
        payload: {
          mesa: 5,
          garcom_id: 2,
          itens: [
            {
              item_comanda_id: 1,
              produto_id: 1,
              nome: 'Cerveja',
              preco_unitario: '10.00',
              quantidade: 2,
            },
          ],
        },
      });

      // Paga só metade
      await app.inject({
        method: 'POST',
        url: '/caixa/comandas/101/pagar',
        payload: {
          forma_pagamento: 'pix',
          valor_aplicado: '10.00',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/101',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().erro.codigo).toBe('NAO_ENCONTRADO');
    });

    it('deve emitir e consultar o recibo operacional com código VAPT-YYYYMMDD-MESA-XXXX e formato .paper completo', async () => {
      await fecharEQuitarComanda(42, 12);

      const res = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/42',
      });

      expect(res.statusCode).toBe(200);
      const corpo = res.json();

      // Campos estruturados
      expect(corpo.comanda_id).toBe(42);
      expect(corpo.mesa).toBe(12);
      expect(corpo.garcom_nome).toBe('Carlos Garçom');
      expect(corpo.operador_caixa).toBe('Ana Caixa');
      expect(corpo.subtotal).toBe('66.80');
      expect(corpo.taxa_servico).toBe('6.68');
      expect(corpo.total).toBe('73.48');
      // 100.00 - 73.48 = 26.52
      expect(corpo.troco_total).toBe('26.52');

      // Código de autenticação no formato VAPT-YYYYMMDD-MESA-XXXX
      expect(corpo.codigo_autenticacao).toMatch(/^VAPT-\d{8}-M12-[A-F0-9]{4}$/);
      expect(corpo.emitido_em).toBeDefined();

      // Lista de itens
      expect(corpo.itens).toHaveLength(2);
      expect(corpo.itens[0]).toEqual({
        nome: 'Hambúrguer Artesanal',
        quantidade: 2,
        preco_unitario: '29.90',
        subtotal: '59.80',
      });
      expect(corpo.itens[1]).toEqual({
        nome: 'Refrigerante Lata',
        quantidade: 1,
        preco_unitario: '7.00',
        subtotal: '7.00',
      });

      // Lista de pagamentos
      expect(corpo.pagamentos).toHaveLength(1);
      expect(corpo.pagamentos[0].forma_pagamento).toBe('dinheiro');
      expect(corpo.pagamentos[0].valor_aplicado).toBe('73.48');
      expect(corpo.pagamentos[0].valor_recebido).toBe('100.00');
      expect(corpo.pagamentos[0].troco).toBe('26.52');

      // Texto térmico .paper gerado
      expect(corpo.paper_text).toBeDefined();
      expect(typeof corpo.paper_text).toBe('string');
      expect(corpo.paper_text).toContain('VAPT PDV - BAR & RESTAURANTE');
      expect(corpo.paper_text).toContain('COMPROVANTE OPERACIONAL DE VENDA');
      expect(corpo.paper_text).toContain('Mesa: 12');
      expect(corpo.paper_text).toContain('Comanda: #42');
      expect(corpo.paper_text).toContain('Hambúrguer Artesanal');
      expect(corpo.paper_text).toContain('Refrigerante Lata');
      expect(corpo.paper_text).toContain('Subtotal:');
      expect(corpo.paper_text).toContain('R$ 66.80');
      expect(corpo.paper_text).toContain('Taxa de Servico (10%):');
      expect(corpo.paper_text).toContain('R$ 6.68');
      expect(corpo.paper_text).toContain('TOTAL A PAGAR:');
      expect(corpo.paper_text).toContain('R$ 73.48');
      expect(corpo.paper_text).toContain('DINHEIRO');
      expect(corpo.paper_text).toContain('Recebido: R$ 100.00');
      expect(corpo.paper_text).toContain('Troco: R$ 26.52');
      expect(corpo.paper_text).toContain(corpo.codigo_autenticacao);
      expect(corpo.paper_text).toContain('Obrigado pela preferencia!');
    });

    it('deve garantir idempotência: chamadas subsequentes a GET /caixa/recibos/:comandaId retornam o mesmo código de autenticação', async () => {
      await fecharEQuitarComanda(45, 4);

      const res1 = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/45',
      });
      expect(res1.statusCode).toBe(200);
      const codigo1 = res1.json().codigo_autenticacao;

      const res2 = await app.inject({
        method: 'GET',
        url: '/caixa/recibos/45',
      });
      expect(res2.statusCode).toBe(200);
      const codigo2 = res2.json().codigo_autenticacao;

      expect(codigo1).toBe(codigo2);
      expect(codigo1).toMatch(/^VAPT-\d{8}-M04-[A-F0-9]{4}$/);
    });
  });
});
