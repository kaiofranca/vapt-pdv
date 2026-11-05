import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildApp } from '../src/app';
import { MemoriaGestaoRepository } from './helpers/memoria.repository';
import { GestaoService } from '../src/modules/gestao/gestao.service';

/**
 * Parser de CSV compatível com RFC 4180 para validação rigorosa
 */
function parsearCsvRfc4180(csv: string): string[][] {
  const linhas: string[][] = [];
  let linhaAtual: string[] = [];
  let campoAtual = '';
  let dentroDeAspas = false;
  let i = 0;

  while (i < csv.length) {
    const char = csv[i];
    const proxChar = csv[i + 1];

    if (dentroDeAspas) {
      if (char === '"') {
        if (proxChar === '"') {
          // Aspa escapada: "" -> "
          campoAtual += '"';
          i += 2;
          continue;
        } else {
          // Fechamento de aspas
          dentroDeAspas = false;
          i++;
          continue;
        }
      } else {
        campoAtual += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        dentroDeAspas = true;
        i++;
        continue;
      } else if (char === ',') {
        linhaAtual.push(campoAtual);
        campoAtual = '';
        i++;
        continue;
      } else if (char === '\r' && proxChar === '\n') {
        linhaAtual.push(campoAtual);
        linhas.push(linhaAtual);
        linhaAtual = [];
        campoAtual = '';
        i += 2;
        continue;
      } else if (char === '\n') {
        linhaAtual.push(campoAtual);
        linhas.push(linhaAtual);
        linhaAtual = [];
        campoAtual = '';
        i++;
        continue;
      } else {
        campoAtual += char;
        i++;
        continue;
      }
    }
  }

  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  return linhas;
}

describe('Bateria de Testes de Estresse, Resiliência e Concorrência — gestao-service (TEA Quality Gate)', () => {
  let app: FastifyInstance;
  let repo: MemoriaGestaoRepository;
  let service: GestaoService;

  beforeEach(async () => {
    repo = new MemoriaGestaoRepository();
    service = new GestaoService(repo);
    app = await buildApp({
      repository: repo,
      service,
      logger: false,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // a) Ingestão concorrente de múltiplos eventos comanda.paga
  // ─────────────────────────────────────────────────────────────
  it('a) Ingestão concorrente de 50 eventos comanda.paga de mesas e garçons distintos com contabilidade exata', async () => {
    const totalComandas = 50;
    const garcons = [
      { id: 1, nome: 'João Garçom' },
      { id: 2, nome: 'Maria Atendente' },
      { id: 3, nome: 'Pedro Silva' },
      { id: 4, nome: 'Ana Costa' },
      { id: 5, nome: 'Lucas Rocha' },
    ];
    const formas = ['pix', 'cartao', 'dinheiro'] as const;

    let subtotalEsperado = new Prisma.Decimal('0.00');
    let taxaEsperada = new Prisma.Decimal('0.00');
    let totalEsperado = new Prisma.Decimal('0.00');
    const porFormaEsperada = {
      pix: new Prisma.Decimal('0.00'),
      cartao: new Prisma.Decimal('0.00'),
      dinheiro: new Prisma.Decimal('0.00'),
    };

    const promessasIngestao = [];

    for (let i = 1; i <= totalComandas; i++) {
      const garcom = garcons[i % garcons.length];
      const forma = formas[i % formas.length];
      const mesa = (i % 20) + 1;

      // Valores variáveis: ex: subtotal R$ 80.00, taxa 10% R$ 8.00, total R$ 88.00
      const subtotalItem = new Prisma.Decimal((50 + (i * 2)).toFixed(2));
      const taxaItem = subtotalItem.mul('0.10');
      const totalItem = subtotalItem.add(taxaItem);

      subtotalEsperado = subtotalEsperado.add(subtotalItem);
      taxaEsperada = taxaEsperada.add(taxaItem);
      totalEsperado = totalEsperado.add(totalItem);
      porFormaEsperada[forma] = porFormaEsperada[forma].add(totalItem);

      const payload = {
        evento_id: randomUUID(),
        evento: 'comanda.paga',
        timestamp: '2026-11-05T12:00:00.000Z',
        paga_em: '2026-11-05T12:00:00.000Z',
        comanda_id: 1000 + i,
        mesa,
        garcom_id: garcom.id,
        garcom_nome: garcom.nome,
        forma_pagamento: forma,
        subtotal: subtotalItem.toFixed(2),
        taxa_servico: taxaItem.toFixed(2),
        total: totalItem.toFixed(2),
        itens: [
          {
            produto_id: (i % 10) + 1,
            nome: `Produto #${(i % 10) + 1}`,
            categoria: i % 2 === 0 ? 'Bebidas' : 'Lanches',
            quantidade: 2,
            preco_unitario: subtotalItem.dividedBy(2).toFixed(2),
            subtotal: subtotalItem.toFixed(2),
          },
        ],
      };

      promessasIngestao.push(
        app.inject({
          method: 'POST',
          url: '/gestao/eventos',
          payload,
        }),
      );
    }

    const respostas = await Promise.all(promessasIngestao);

    // Todas as 50 requisições devem responder 202 Accepted
    for (const res of respostas) {
      expect(res.statusCode).toBe(202);
      const json = JSON.parse(res.payload);
      expect(json.processado).toBe(true);
      expect(json.duplicado).toBe(false);
    }

    // Conferência do Resumo Diário Consolidado
    const resResumo = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-05',
    });
    expect(resResumo.statusCode).toBe(200);
    const resumo = JSON.parse(resResumo.payload);

    expect(resumo.quantidade_pedidos).toBe(totalComandas);
    expect(resumo.total_subtotal).toBe(subtotalEsperado.toFixed(2));
    expect(resumo.total_taxa_servico).toBe(taxaEsperada.toFixed(2));
    expect(resumo.total_vendas).toBe(totalEsperado.toFixed(2));
    expect(resumo.ticket_medio).toBe(
      totalEsperado.dividedBy(totalComandas).toFixed(2),
    );
    expect(resumo.por_forma_pagamento.pix).toBe(porFormaEsperada.pix.toFixed(2));
    expect(resumo.por_forma_pagamento.cartao).toBe(porFormaEsperada.cartao.toFixed(2));
    expect(resumo.por_forma_pagamento.dinheiro).toBe(porFormaEsperada.dinheiro.toFixed(2));

    // Conferência do Desempenho dos Garçons
    const resGarcons = await app.inject({
      method: 'GET',
      url: '/gestao/desempenho-garcons',
    });
    expect(resGarcons.statusCode).toBe(200);
    const garconsBody = JSON.parse(resGarcons.payload);
    expect(garconsBody.garcons.length).toBe(garcons.length);

    const totalComandasGarcons = garconsBody.garcons.reduce(
      (acc: number, g: any) => acc + g.comandas_atendidas,
      0,
    );
    expect(totalComandasGarcons).toBe(totalComandas);

    const somaVendasGarcons = garconsBody.garcons.reduce(
      (acc: Prisma.Decimal, g: any) => acc.add(new Prisma.Decimal(g.total_vendido)),
      new Prisma.Decimal('0.00'),
    );
    expect(somaVendasGarcons.toFixed(2)).toBe(subtotalEsperado.toFixed(2));
  });

  // ─────────────────────────────────────────────────────────────
  // b) Cálculo de Curva ABC com empate de receitas e dezenas de produtos
  // ─────────────────────────────────────────────────────────────
  it('b) Cálculo determinístico de Curva ABC com empate de receitas em dezenas de produtos', async () => {
    // Cenário: 40 produtos:
    // P1..P5: Receita alta de R$ 800.00 cada (5 * 800 = R$ 4000.00) -> devem ser Classe A
    // P6..P15: 10 produtos empatados com exatamente R$ 75.00 cada (10 * 75 = R$ 750.00) -> Classe B
    // P16..P40: 25 produtos empatados com exatamente R$ 10.00 cada (25 * 10 = R$ 250.00) -> Classe C
    // Total Geral: R$ 5000.00
    // P1..P5 acumulam 4000/5000 = 80.00% -> exatamente classe A
    // P6..P15 acumulam 4000 + 750 = 4750/5000 = 95.00% -> classe B
    // P16..P40 acumulam restante 250 = 100.00% -> classe C

    const itensPayload: any[] = [];

    // P1..P5
    for (let p = 1; p <= 5; p++) {
      itensPayload.push({
        produto_id: p,
        nome: `Produto Premium #${p}`,
        categoria: 'Destaques',
        quantidade: 8,
        preco_unitario: '100.00',
        subtotal: '800.00',
      });
    }

    // P6..P15 (Empate na receita R$ 75.00)
    for (let p = 6; p <= 15; p++) {
      itensPayload.push({
        produto_id: p,
        nome: `Produto Médio Empatado #${p}`,
        categoria: 'Médios',
        quantidade: 3,
        preco_unitario: '25.00',
        subtotal: '75.00',
      });
    }

    // P16..P40 (Empate na receita R$ 10.00)
    for (let p = 16; p <= 40; p++) {
      itensPayload.push({
        produto_id: p,
        nome: `Produto Baixo Empatado #${p}`,
        categoria: 'Básicos',
        quantidade: 1,
        preco_unitario: '10.00',
        subtotal: '10.00',
      });
    }

    const resPost = await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload: {
        evento_id: randomUUID(),
        evento: 'comanda.paga',
        timestamp: '2026-11-05T14:00:00.000Z',
        subtotal: '5000.00',
        taxa_servico: '500.00',
        total: '5500.00',
        forma_pagamento: 'pix',
        itens: itensPayload,
      },
    });

    const resRanking = await app.inject({
      method: 'GET',
      url: '/gestao/ranking-produtos?limite=50',
    });
    expect(resRanking.statusCode).toBe(200);
    const body = JSON.parse(resRanking.payload);

    expect(body.produtos.length).toBe(40);
    expect(body.receita_total_acumulada).toBe('5000.00');

    // Validação das posições sequenciais sem lacunas
    for (let i = 0; i < body.produtos.length; i++) {
      expect(body.produtos[i].posicao).toBe(i + 1);
    }

    // P1..P5 devem ser Classe A
    for (let i = 0; i < 5; i++) {
      expect(body.produtos[i].classe_abc).toBe('A');
      expect(body.produtos[i].receita_gerada).toBe('800.00');
    }

    // P6..P15 devem estar ordenados determinística e sequencialmente por produto_id
    for (let i = 5; i < 15; i++) {
      const p = body.produtos[i];
      expect(p.classe_abc).toBe('B');
      expect(p.receita_gerada).toBe('75.00');
      expect(p.produto_id).toBe(i + 1); // Desempate determinístico por produto_id crescente
    }

    // P16..P40 devem ser Classe C
    for (let i = 15; i < 40; i++) {
      const p = body.produtos[i];
      expect(p.classe_abc).toBe('C');
      expect(p.receita_gerada).toBe('10.00');
      expect(p.produto_id).toBe(i + 1);
    }

    // O último produto deve ter percentual acumulado de 100.00%
    const ultimo = body.produtos[body.produtos.length - 1];
    expect(Number(ultimo.percentual_acumulado)).toBeCloseTo(100.00, 2);
  });

  // ─────────────────────────────────────────────────────────────
  // c) Verificação rigorosa de arredondamento em DECIMAL(10,2) / DECIMAL(12,2)
  // ─────────────────────────────────────────────────────────────
  it('c) Verificação rigorosa de arredondamento sem deriva de centavos em dízimas e somas fracionárias', async () => {
    // Teste com dízimas fracionárias: 3 comandas de subtotal R$ 33.33, taxa R$ 3.33 (10%), total R$ 36.66
    // Soma exata esperada:
    // Subtotal: 3 * 33.33 = 99.99
    // Taxa: 3 * 3.33 = 9.99
    // Total: 3 * 36.66 = 109.98
    for (let i = 1; i <= 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/gestao/eventos',
        payload: {
          evento_id: randomUUID(),
          evento: 'comanda.paga',
          timestamp: '2026-11-05T15:00:00.000Z',
          paga_em: '2026-11-05T15:00:00.000Z',
          garcom_id: 10,
          garcom_nome: 'Marcos Arredondamento',
          forma_pagamento: 'pix',
          subtotal: '33.33',
          taxa_servico: '3.33',
          total: '36.66',
          itens: [
            {
              produto_id: 100,
              nome: 'Item Fracionário',
              categoria: 'Especial',
              quantidade: 1,
              preco_unitario: '33.33',
              subtotal: '33.33',
            },
          ],
        },
      });
      expect(res.statusCode).toBe(202);
    }

    const resResumo = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-05',
    });
    const resumo = JSON.parse(resResumo.payload);

    expect(resumo.total_subtotal).toBe('99.99');
    expect(resumo.total_taxa_servico).toBe('9.99');
    expect(resumo.total_vendas).toBe('109.98');
    // Ticket médio: 109.98 / 3 = 36.66
    expect(resumo.ticket_medio).toBe('36.66');

    // Comissão do garçom deve ser exatamente 9.99
    const resGarcom = await app.inject({
      method: 'GET',
      url: '/gestao/desempenho-garcons',
    });
    const garcons = JSON.parse(resGarcom.payload).garcons;
    const garcom10 = garcons.find((g: any) => g.garcom_id === 10);
    expect(garcom10).toBeDefined();
    expect(garcom10.total_vendido).toBe('99.99');
    expect(garcom10.comissao_gerada).toBe('9.99');
  });

  // ─────────────────────────────────────────────────────────────
  // d) Exportação CSV em larga escala testando conformidade com RFC 4180
  // ─────────────────────────────────────────────────────────────
  it('d) Exportação CSV em conformidade estrita com RFC 4180 (aspas, quebras de linha e vírgulas em strings)', async () => {
    // Cadastrar produtos e garçons com caracteres especiais que exigem escape RFC 4180
    const nomeComVirgula = 'Prato Executivo, Completo com Salada & Fritas';
    const nomeComAspas = 'Chopp Artesanal "Super" Gelado 500ml';
    const nomeComQuebraLinha = 'Pizza Grande\nBorda Vulcânica de Catupiry';
    const garcomComAspasEVirgula = 'Carlos "O Ágil", Atendente Chefe';

    await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload: {
        evento_id: randomUUID(),
        evento: 'comanda.paga',
        timestamp: '2026-11-05T16:00:00.000Z',
        paga_em: '2026-11-05T16:00:00.000Z',
        subtotal: '250.00',
        taxa_servico: '25.00',
        total: '275.00',
        garcom_id: 77,
        garcom_nome: garcomComAspasEVirgula,
        forma_pagamento: 'cartao',
        itens: [
          {
            produto_id: 501,
            nome: nomeComVirgula,
            categoria: 'Refeições',
            quantidade: 1,
            preco_unitario: '100.00',
            subtotal: '100.00',
          },
          {
            produto_id: 502,
            nome: nomeComAspas,
            categoria: 'Bebidas',
            quantidade: 2,
            preco_unitario: '50.00',
            subtotal: '100.00',
          },
          {
            produto_id: 503,
            nome: nomeComQuebraLinha,
            categoria: 'Pizzas',
            quantidade: 1,
            preco_unitario: '50.00',
            subtotal: '50.00',
          },
        ],
      },
    });

    // 1. Testar exportação de PRODUTOS
    const resCsvProdutos = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=produtos&formato=csv',
    });
    expect(resCsvProdutos.statusCode).toBe(200);
    expect(resCsvProdutos.headers['content-type']).toContain('text/csv');
    expect(resCsvProdutos.headers['content-disposition']).toContain('relatorio-produtos.csv');

    const csvProds = resCsvProdutos.payload;
    const matrizProds = parsearCsvRfc4180(csvProds);

    // Linha 0 = Cabeçalho RFC 4180
    expect(matrizProds[0]).toEqual([
      'posicao',
      'produto_id',
      'nome_produto',
      'categoria',
      'quantidade_vendida',
      'receita_gerada',
      'percentual_receita',
      'percentual_acumulado',
      'classe_abc',
    ]);

    // Verificar se os 3 produtos foram recuperados com exatidão pelo parser RFC 4180
    const linhasDados = matrizProds.slice(1);
    const prodVirgula = linhasDados.find((l) => l[1] === '501');
    const prodAspas = linhasDados.find((l) => l[1] === '502');
    const prodQuebra = linhasDados.find((l) => l[1] === '503');

    expect(prodVirgula).toBeDefined();
    expect(prodVirgula![2]).toBe(nomeComVirgula);

    expect(prodAspas).toBeDefined();
    expect(prodAspas![2]).toBe(nomeComAspas);

    expect(prodQuebra).toBeDefined();
    expect(prodQuebra![2]).toBe(nomeComQuebraLinha);

    // 2. Testar exportação de GARÇONS
    const resCsvGarcons = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=garcons&formato=csv',
    });
    expect(resCsvGarcons.statusCode).toBe(200);
    const matrizGarcons = parsearCsvRfc4180(resCsvGarcons.payload);
    const garcomRecuperado = matrizGarcons.find((l) => l[0] === '77');
    expect(garcomRecuperado).toBeDefined();
    expect(garcomRecuperado![1]).toBe(garcomComAspasEVirgula);

    // 3. Testar exportação de FATURAMENTO
    const resCsvFat = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=faturamento&formato=csv',
    });
    expect(resCsvFat.statusCode).toBe(200);
    const matrizFat = parsearCsvRfc4180(resCsvFat.payload);
    expect(matrizFat[0]).toEqual([
      'data',
      'comandas_pagas',
      'comandas_canceladas',
      'faturamento_subtotal',
      'total_taxa_servico',
      'faturamento_total',
      'ticket_medio',
      'pix',
      'cartao',
      'dinheiro',
    ]);
  });

  // ─────────────────────────────────────────────────────────────
  // e) Ingestão com payload inválido retornando 400 sem corromper estado analítico
  // ─────────────────────────────────────────────────────────────
  it('e) Ingestão com múltiplos payloads inválidos rejeitada com 400 sem corromper estado analítico', async () => {
    // 1. Criar estado analítico inicial válido
    await app.inject({
      method: 'POST',
      url: '/gestao/eventos',
      payload: {
        evento_id: randomUUID(),
        evento: 'comanda.paga',
        timestamp: '2026-11-05T10:00:00.000Z',
        paga_em: '2026-11-05T10:00:00.000Z',
        subtotal: '100.00',
        taxa_servico: '10.00',
        total: '110.00',
        forma_pagamento: 'pix',
        itens: [
          {
            produto_id: 1,
            nome: 'Suco Natural',
            categoria: 'Bebidas',
            quantidade: 2,
            preco_unitario: '50.00',
            subtotal: '100.00',
          },
        ],
      },
    });

    const baselineResumo = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-05',
    });
    const resumoInicial = JSON.parse(baselineResumo.payload);
    expect(resumoInicial.quantidade_pedidos).toBe(1);
    expect(resumoInicial.total_vendas).toBe('110.00');

    // 2. Disparar rajada de payloads maliciosos ou inválidos
    const payloadsInvalidos = [
      {}, // Vazio
      { evento: 'comanda.paga' }, // Sem evento_id
      { evento_id: '123' }, // Sem evento
      { evento_id: '456', evento: 'comanda.paga', total: 110.0 }, // total como number em vez de string
      { evento_id: '789', evento: 'comanda.paga', itens: 'nao-e-array' }, // itens inválido
      { evento_id: '000', evento: 'comanda.paga', itens: [{ quantidade: -5 }] }, // quantidade negativa
    ];

    for (const p of payloadsInvalidos) {
      const resInvalido = await app.inject({
        method: 'POST',
        url: '/gestao/eventos',
        payload: p,
      });
      expect(resInvalido.statusCode).toBe(400);
      const err = JSON.parse(resInvalido.payload);
      expect(err.erro).toBeDefined();
    }

    // 3. Garantir que o estado analítico não foi corrompido ou alterado
    const checkResumo = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-05',
    });
    const resumoFinal = JSON.parse(checkResumo.payload);
    expect(resumoFinal).toEqual(resumoInicial);
  });

  // ─────────────────────────────────────────────────────────────
  // f) Idempotência absoluta com o mesmo evento_id repetido em rajada
  // ─────────────────────────────────────────────────────────────
  it('f) Idempotência absoluta com o mesmo evento_id repetido em rajada de 20 requisições simultâneas', async () => {
    const mesmoEventoId = randomUUID();
    const payloadUnico = {
      evento_id: mesmoEventoId,
      evento: 'comanda.paga',
      timestamp: '2026-11-05T18:00:00.000Z',
      paga_em: '2026-11-05T18:00:00.000Z',
      subtotal: '200.00',
      taxa_servico: '20.00',
      total: '220.00',
      forma_pagamento: 'cartao',
      garcom_id: 8,
      garcom_nome: 'Garçom Idempotência',
      itens: [
        {
          produto_id: 30,
          nome: 'Petisco Especial',
          categoria: 'Porções',
          quantidade: 2,
          preco_unitario: '100.00',
          subtotal: '200.00',
        },
      ],
    };

    // Disparar 20 requisições simultâneas com exatamente o mesmo evento_id
    const rajadaPromessas = Array.from({ length: 20 }, () =>
      app.inject({
        method: 'POST',
        url: '/gestao/eventos',
        payload: payloadUnico,
      }),
    );

    const resultados = await Promise.all(rajadaPromessas);

    // Contar requisições aceitas (202) e duplicadas idempotentes (200)
    let aceitasPrimeiraVez = 0;
    let rejeitadasPorIdempotencia = 0;

    for (const res of resultados) {
      if (res.statusCode === 202) {
        aceitasPrimeiraVez++;
        const body = JSON.parse(res.payload);
        expect(body.duplicado).toBe(false);
      } else if (res.statusCode === 200) {
        rejeitadasPorIdempotencia++;
        const body = JSON.parse(res.payload);
        expect(body.duplicado).toBe(true);
      } else {
        throw new Error(`Código inesperado: ${res.statusCode}`);
      }
    }

    // Exatamente uma requisição deve ter sido processada originalmente
    expect(aceitasPrimeiraVez).toBe(1);
    expect(rejeitadasPorIdempotencia).toBe(19);

    // Validar que o faturamento aumentou exatamente UMA vez (R$ 220.00 e 1 pedido)
    const resResumo = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-05',
    });
    const resumo = JSON.parse(resResumo.payload);
    expect(resumo.quantidade_pedidos).toBe(1);
    expect(resumo.total_vendas).toBe('220.00');
    expect(resumo.total_subtotal).toBe('200.00');
    expect(resumo.total_taxa_servico).toBe('20.00');

    // Validar produto computado exatamente uma vez
    const resRanking = await app.inject({
      method: 'GET',
      url: '/gestao/ranking-produtos',
    });
    const ranking = JSON.parse(resRanking.payload);
    const prod = ranking.produtos.find((p: any) => p.produto_id === 30);
    expect(prod).toBeDefined();
    expect(prod.quantidade_vendida).toBe(2);
    expect(prod.receita_gerada).toBe('200.00');
  });
});
