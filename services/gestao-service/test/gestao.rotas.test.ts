import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoriaGestaoRepository } from './helpers/memoria.repository';
import { GestaoService } from '../src/modules/gestao/gestao.service';

describe('Rotas HTTP gestao-service (Testes de Integração)', () => {
  let app: FastifyInstance;
  let repo: MemoriaGestaoRepository;

  beforeAll(async () => {
    repo = new MemoriaGestaoRepository();
    const service = new GestaoService(repo);
    app = await buildApp({
      repository: repo,
      service,
      logger: false,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health deve retornar 200 OK com status e nome do serviço', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.servico).toBe('gestao-service');
    expect(body.timestamp).toBeDefined();
  });

  it('POST /gestao/eventos deve aceitar comanda.paga e responder 202 Accepted', async () => {
    const eventoId = '11111111-2222-4333-8444-555555555555';
    const payload = {
      evento_id: eventoId,
      evento: 'comanda.paga',
      timestamp: '2026-11-04T20:30:00.000Z',
      paga_em: '2026-11-04T20:30:00.000Z',
      comanda_id: 15,
      mesa: 3,
      garcom_id: 1,
      garcom_nome: 'Carlos Garçom',
      forma_pagamento: 'pix',
      subtotal: '200.00',
      taxa_servico: '20.00',
      total: '220.00',
      itens: [
        {
          produto_id: 10,
          nome: 'Filé com Fritas',
          categoria: 'Porções',
          quantidade: 2,
          preco_unitario: '100.00',
          subtotal: '200.00',
        },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.evento_id).toBe(eventoId);
    expect(body.processado).toBe(true);
    expect(body.duplicado).toBe(false);

    // Reenvio com mesmo ID -> 200 OK (idempotente)
    const resDup = await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload,
    });

    expect(resDup.statusCode).toBe(200);
    const bodyDup = JSON.parse(resDup.payload);
    expect(bodyDup.duplicado).toBe(true);
  });

  it('POST /analytics/eventos (alias) deve responder de forma idêntica', async () => {
    const eventoId = '22222222-3333-4444-8555-666666666666';
    const res = await app.inject({
      method: 'POST',
      url: '/analytics/eventos',
      payload: {
        evento_id: eventoId,
        evento: 'comanda.paga',
        timestamp: '2026-11-04T20:35:00.000Z',
        paga_em: '2026-11-04T20:35:00.000Z',
        subtotal: '50.00',
        total: '50.00',
        forma_pagamento: 'cartao',
        itens: [],
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.evento_id).toBe(eventoId);
  });

  it('GET /gestao/resumo-diario e GET /analytics/resumo-diario devem retornar dados consolidados', async () => {
    const resGestao = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-04',
    });
    expect(resGestao.statusCode).toBe(200);
    const bodyGestao = JSON.parse(resGestao.payload);
    expect(bodyGestao.data).toBe('2026-11-04');
    expect(Number(bodyGestao.total_vendas)).toBeGreaterThan(0);
    expect(bodyGestao.por_forma_pagamento).toBeDefined();

    const resAnalytics = await app.inject({
      method: 'GET',
      url: '/analytics/resumo-diario?data=2026-11-04',
    });
    expect(resAnalytics.statusCode).toBe(200);
    expect(resAnalytics.payload).toBe(resGestao.payload);
  });

  it('GET /gestao/ranking-produtos deve retornar classificação Curva ABC', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/gestao/ranking-produtos',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.receita_total_acumulada).toBeDefined();
    expect(Array.isArray(body.produtos)).toBe(true);
    if (body.produtos.length > 0) {
      expect(body.produtos[0].classe_abc).toBeDefined();
      expect(['A', 'B', 'C']).toContain(body.produtos[0].classe_abc);
    }
  });

  it('GET /gestao/desempenho-garcons deve listar produtividade da equipe', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/gestao/desempenho-garcons',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.garcons)).toBe(true);
  });

  it('GET /gestao/alertas-estoque deve listar alertas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/gestao/alertas-estoque',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.alertas)).toBe(true);
  });

  it('GET /gestao/exportar deve suportar CSV e JSON', async () => {
    // CSV
    const resCsv = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=faturamento&formato=csv',
    });
    expect(resCsv.statusCode).toBe(200);
    expect(resCsv.headers['content-type']).toContain('text/csv');
    expect(resCsv.headers['content-disposition']).toContain('attachment; filename="relatorio-faturamento.csv"');

    // JSON
    const resJson = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=faturamento&formato=json',
    });
    expect(resJson.statusCode).toBe(200);
    expect(resJson.headers['content-type']).toContain('application/json');
    const jsonBody = JSON.parse(resJson.payload);
    expect(Array.isArray(jsonBody)).toBe(true);
  });

  it('POST /gestao/eventos com body inválido deve retornar 400 e envelope RFC 7807', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload: {
        // Falta evento_id e evento
        timestamp: 'invalido',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.erro).toBeDefined();
    expect(body.erro.codigo).toBe('VALIDACAO');
    expect(body.erro.mensagem).toBeDefined();
    expect(body.erro.detalhes).toBeDefined();
  });
});
