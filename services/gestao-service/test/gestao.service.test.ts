import { describe, it, expect, beforeEach } from 'vitest';
import { GestaoService } from '../src/modules/gestao/gestao.service';
import { MemoriaGestaoRepository } from './helpers/memoria.repository';
import { EnvelopeEventoOperacional } from '../src/modules/gestao/schemas';

describe('GestaoService (Testes Unitários de Regra de Negócio e OLAP)', () => {
  let repo: MemoriaGestaoRepository;
  let service: GestaoService;

  beforeEach(() => {
    repo = new MemoriaGestaoRepository();
    service = new GestaoService(repo);
  });

  it('deve processar evento comanda.paga e atualizar faturamento diário', async () => {
    const evento: EnvelopeEventoOperacional = {
      evento_id: 'a1b2c3d4-e5f6-4a1b-8c2d-123456789abc',
      evento: 'comanda.paga',
      timestamp: '2026-11-04T20:00:00.000Z',
      paga_em: '2026-11-04T20:00:00.000Z',
      comanda_id: 10,
      mesa: 4,
      forma_pagamento: 'pix',
      subtotal: '100.00',
      taxa_servico: '10.00',
      total: '110.00',
      garcom_id: 2,
      garcom_nome: 'Lucas Garçom',
      itens: [
        {
          produto_id: 1,
          nome: 'Chopp Pilsen 500ml',
          categoria: 'Bebidas',
          quantidade: 4,
          preco_unitario: '15.00',
          subtotal: '60.00',
        },
        {
          produto_id: 2,
          nome: 'Batata Frita',
          categoria: 'Porções',
          quantidade: 1,
          preco_unitario: '40.00',
          subtotal: '40.00',
        },
      ],
    };

    const res = await service.processarEvento(evento);
    expect(res.processado).toBe(true);
    expect(res.duplicado).toBe(false);

    // Consulta resumo diário
    const resumo = await service.obterResumoDiario('2026-11-04');
    expect(resumo.total_vendas).toBe('110.00');
    expect(resumo.total_subtotal).toBe('100.00');
    expect(resumo.total_taxa_servico).toBe('10.00');
    expect(resumo.quantidade_pedidos).toBe(1);
    expect(resumo.ticket_medio).toBe('110.00');
    expect(resumo.por_forma_pagamento.pix).toBe('110.00');
  });

  it('deve garantir idempotência estrita ao reprocessar mesmo evento_id', async () => {
    const eventoId = 'f1e2d3c4-b5a6-4f1e-8d2c-987654321fed';
    const evento: EnvelopeEventoOperacional = {
      evento_id: eventoId,
      evento: 'comanda.paga',
      timestamp: '2026-11-04T21:00:00.000Z',
      paga_em: '2026-11-04T21:00:00.000Z',
      subtotal: '50.00',
      taxa_servico: '5.00',
      total: '55.00',
      forma_pagamento: 'dinheiro',
      itens: [],
    };

    const primeiraVez = await service.processarEvento(evento);
    expect(primeiraVez.duplicado).toBe(false);

    const segundaVez = await service.processarEvento(evento);
    expect(segundaVez.duplicado).toBe(true);
    expect(segundaVez.processado).toBe(true);

    // Faturamento não deve ter duplicado
    const resumo = await service.obterResumoDiario('2026-11-04');
    expect(resumo.total_vendas).toBe('55.00');
    expect(resumo.quantidade_pedidos).toBe(1);
  });

  it('deve calcular corretamente a Curva ABC 80/15/5 dos produtos', async () => {
    // 3 produtos com receitas distintas:
    // P1: R$ 800.00 (80% da receita total de R$ 1000) -> Classe A
    // P2: R$ 150.00 (15% acumulado 95%) -> Classe B
    // P3: R$ 50.00 (5% acumulado 100%) -> Classe C
    await service.processarEvento({
      evento_id: 'abc-evento-1',
      evento: 'comanda.paga',
      timestamp: '2026-11-04T12:00:00.000Z',
      subtotal: '1000.00',
      total: '1000.00',
      forma_pagamento: 'cartao',
      itens: [
        { produto_id: 1, nome: 'Picanha na Chapa', categoria: 'Porções', quantidade: 8, subtotal: '800.00' },
        { produto_id: 2, nome: 'Chopp Pilsen', categoria: 'Bebidas', quantidade: 10, subtotal: '150.00' },
        { produto_id: 3, nome: 'Água Mineral', categoria: 'Bebidas', quantidade: 10, subtotal: '50.00' },
      ],
    });

    const ranking = await service.obterRankingProdutos();
    expect(ranking.receita_total_acumulada).toBe('1000.00');
    expect(ranking.produtos).toHaveLength(3);

    // Produto 1: Picanha
    expect(ranking.produtos[0].nome_produto).toBe('Picanha na Chapa');
    expect(ranking.produtos[0].classe_abc).toBe('A');
    expect(ranking.produtos[0].percentual_receita).toBe('80.00');

    // Produto 2: Chopp
    expect(ranking.produtos[1].nome_produto).toBe('Chopp Pilsen');
    expect(ranking.produtos[1].classe_abc).toBe('B');

    // Produto 3: Água
    expect(ranking.produtos[2].nome_produto).toBe('Água Mineral');
    expect(ranking.produtos[2].classe_abc).toBe('C');
  });

  it('deve acumular comissões de 10% e faturamento por garçom', async () => {
    await service.processarEvento({
      evento_id: 'garcom-venda-1',
      evento: 'comanda.paga',
      timestamp: '2026-11-04T19:00:00.000Z',
      subtotal: '200.00',
      taxa_servico: '20.00',
      total: '220.00',
      garcom_id: 5,
      garcom_nome: 'Marcos Salão',
      itens: [],
    });

    const { garcons } = await service.obterDesempenhoGarcons();
    expect(garcons).toHaveLength(1);
    expect(garcons[0].garcom_id).toBe(5);
    expect(garcons[0].garcom_nome).toBe('Marcos Salão');
    expect(garcons[0].comandas_atendidas).toBe(1);
    expect(garcons[0].total_vendido).toBe('200.00');
    expect(garcons[0].comissao_gerada).toBe('20.00');
  });

  it('deve registrar e remover alertas de estoque conforme movimentação', async () => {
    // Estoque cai abaixo do mínimo (3 <= 5) -> Alerta "baixo"
    await service.processarEvento({
      evento_id: 'est-1',
      evento: 'estoque.movimentado',
      timestamp: '2026-11-04T15:00:00.000Z',
      produto_id: 12,
      nome_produto: 'Refrigerante Cola',
      categoria: 'Bebidas',
      estoque_atual: 3,
      estoque_minimo: 5,
    });

    let { alertas } = await service.obterAlertasEstoque();
    expect(alertas).toHaveLength(1);
    expect(alertas[0].produto_id).toBe(12);
    expect(alertas[0].nivel).toBe('baixo');

    // Estoque zera (0 <= 5) -> Alerta "zerado"
    await service.processarEvento({
      evento_id: 'est-2',
      evento: 'estoque.movimentado',
      timestamp: '2026-11-04T16:00:00.000Z',
      produto_id: 12,
      nome_produto: 'Refrigerante Cola',
      categoria: 'Bebidas',
      estoque_atual: 0,
      estoque_minimo: 5,
    });

    alertas = (await service.obterAlertasEstoque()).alertas;
    expect(alertas[0].nivel).toBe('zerado');

    // Estoque reposto (15 > 5) -> Alerta removido
    await service.processarEvento({
      evento_id: 'est-3',
      evento: 'estoque.movimentado',
      timestamp: '2026-11-04T17:00:00.000Z',
      produto_id: 12,
      nome_produto: 'Refrigerante Cola',
      categoria: 'Bebidas',
      estoque_atual: 15,
      estoque_minimo: 5,
    });

    alertas = (await service.obterAlertasEstoque()).alertas;
    expect(alertas).toHaveLength(0);
  });

  it('deve exportar relatório em formato CSV e JSON', async () => {
    await service.processarEvento({
      evento_id: 'exp-1',
      evento: 'comanda.paga',
      timestamp: '2026-11-04T18:00:00.000Z',
      paga_em: '2026-11-04T18:00:00.000Z',
      subtotal: '100.00',
      taxa_servico: '10.00',
      total: '110.00',
      forma_pagamento: 'pix',
      itens: [{ produto_id: 1, nome: 'Vinho Tinto', categoria: 'Bebidas', quantidade: 1, subtotal: '100.00' }],
    });

    // CSV
    const expCsv = await service.exportarRelatorio('faturamento', 'csv');
    expect(expCsv.contentType).toContain('text/csv');
    expect(expCsv.filename).toBe('relatorio-faturamento.csv');
    expect(typeof expCsv.dados).toBe('string');
    expect(expCsv.dados).toContain('data,comandas_pagas,comandas_canceladas');
    expect(expCsv.dados).toContain('110.00');

    // JSON
    const expJson = await service.exportarRelatorio('faturamento', 'json');
    expect(expJson.contentType).toContain('application/json');
    expect(Array.isArray(expJson.dados)).toBe(true);
  });
});
