import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  HttpGestaoGateway,
  RespostaNotificacaoGestao,
} from '../src/shared/gateways/gestao.gateway';
import { MemoriaCobrancasRepository } from './helpers/memoria.repository';
import { CobrancasService } from '../src/modules/caixa/cobrancas.service';
import { EstoqueCoreGateway } from '../src/modules/caixa/gateways';

describe('HttpGestaoGateway — Ingestão de Eventos no gestao-service (ADR-01, ADR-07, SM-C2)', () => {
  const gestaoUrl = 'http://localhost:3003';
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  const payloadComandaPaga = {
    evento_id: 'e0444444-2222-4333-8444-555555555555',
    evento: 'comanda.paga',
    versao: 1,
    ocorrido_em: '2026-11-04T22:00:00.000Z',
    data_hora: '2026-11-04T22:00:00.000Z',
    timestamp: '2026-11-04T22:00:00.000Z',
    comanda_id: 42,
    mesa: 12,
    garcom_id: 1,
    garcom_nome: 'Carlos Garçom',
    forma_pagamento: 'pix',
    aplicar_taxa_servico: true,
    subtotal: '59.80',
    valor_subtotal: '59.80',
    taxa_servico: '5.98',
    total: '65.78',
    valor_total: '65.78',
    troco: '0.00',
    troco_total: '0.00',
    paga_em: '2026-11-04T22:00:00.000Z',
    itens: [
      {
        item_comanda_id: 101,
        produto_id: 7,
        nome: 'Hambúrguer Artesanal',
        preco_unitario: '29.90',
        quantidade: 2,
        subtotal: '59.80',
      },
    ],
  };

  it('deve enviar evento com sucesso retornando 202 Accepted (processamento novo)', async () => {
    const mockWarn = vi.fn();
    const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        evento_id: payloadComandaPaga.evento_id,
        evento: 'comanda.paga',
        processado: true,
        duplicado: false,
        processado_em: '2026-11-04T22:00:01.000Z',
      }),
    } as any);

    const resultado = await gateway.notificarComandaPaga(payloadComandaPaga);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.duplicado).toBe(false);
    expect(resultado.statusCode).toBe(202);
    expect(resultado.dados?.processado).toBe(true);
    expect(mockWarn).not.toHaveBeenCalled();

    // Valida chamada HTTP
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [urlChamada, initChamada] = (globalThis.fetch as any).mock.calls[0];
    expect(urlChamada).toBe('http://localhost:3003/gestao/eventos');
    expect(initChamada.method).toBe('POST');
    expect(initChamada.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(initChamada.body)).toEqual(payloadComandaPaga);
  });

  it('deve tratar evento duplicado retornando 200 OK com duplicado: true de forma idempotente', async () => {
    const gateway = new HttpGestaoGateway(gestaoUrl);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        evento_id: payloadComandaPaga.evento_id,
        evento: 'comanda.paga',
        processado: true,
        duplicado: true,
        processado_em: '2026-11-04T22:00:00.000Z',
      }),
    } as any);

    const resultado = await gateway.notificarComandaPaga(payloadComandaPaga);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.duplicado).toBe(true);
    expect(resultado.statusCode).toBe(200);
  });

  it('deve degradar graciosamente com log quando o gestao-service responde status de erro 500/503', async () => {
    const mockWarn = vi.fn();
    const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        erro: { codigo: 'SERVICO_INDISPONIVEL', mensagem: 'Banco em manutenção' },
      }),
    } as any);

    const resultado = await gateway.notificarComandaPaga(payloadComandaPaga);

    expect(resultado.sucesso).toBe(false);
    expect(resultado.statusCode).toBe(503);
    expect(resultado.erro).toContain('503');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain('HTTP 503');
  });

  it('deve tratar timeout da requisição (2000ms) sem estourar exceção', async () => {
    const mockWarn = vi.fn();
    const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    globalThis.fetch = vi.fn().mockRejectedValue(timeoutError);

    const resultado = await gateway.notificarComandaPaga(payloadComandaPaga);

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toContain('timeout');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][0]).toContain('Degradação graciosa');
  });

  it('deve tratar queda de rede (ECONNREFUSED) com degradação graciosa', async () => {
    const mockWarn = vi.fn();
    const gateway = new HttpGestaoGateway(gestaoUrl, { warn: mockWarn });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3003'));

    const resultado = await gateway.notificarEvento({ evento: 'estoque.movimentado' });

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toContain('ECONNREFUSED');
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('deve garantir que liquidação no CobrancasService funciona mesmo com falha no GestaoGateway', async () => {
    const repository = new MemoriaCobrancasRepository();
    const mockEstoqueGateway: EstoqueCoreGateway = {
      baixarEstoque: vi.fn().mockResolvedValue(undefined),
    };
    const mockGestaoGateway: HttpGestaoGateway = new HttpGestaoGateway(gestaoUrl);

    // Mock fetch com falha
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('gestao-service offline'));

    const cobrancasService = new CobrancasService(
      repository,
      mockEstoqueGateway,
      mockGestaoGateway,
    );

    // Abre comanda no caixa
    await cobrancasService.fecharOuRecalcular(100, {
      mesa: 5,
      garcom_id: 1,
      itens: [
        {
          item_comanda_id: 1,
          produto_id: 10,
          nome: 'Suco Natural',
          preco_unitario: '10.00',
          quantidade: 2,
        },
      ],
      aplicar_taxa_servico: false,
    });

    // Quita integralmente
    const resultadoPagamento = await cobrancasService.pagarComanda(100, {
      forma_pagamento: 'dinheiro',
      valor_recebido: '20.00',
    });

    // Venda concluída e comanda quitada com sucesso (SM-C2)
    expect(resultadoPagamento.status).toBe('paga');
    expect(resultadoPagamento.saldo_restante).toBe('0.00');
    expect(resultadoPagamento.recibo).toBeDefined();

    const comandaSalva = await repository.buscarPorComandaId(100);
    expect(comandaSalva?.status).toBe('paga');
    expect(mockEstoqueGateway.baixarEstoque).toHaveBeenCalledTimes(1);
  });
});
