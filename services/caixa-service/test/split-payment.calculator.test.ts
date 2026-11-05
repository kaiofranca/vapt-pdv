import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calcularDivisaoPorPessoas,
  calcularDivisaoPorItens,
  ItemComandaParaDivisao,
} from '../src/modules/caixa/split-payment.calculator';
import { ErroDominio } from '../src/shared/erros';

describe('Split Payment Calculator — Divisão por Pessoas (Story 15.3, RN19)', () => {
  function somarCotas(cotas: { valor: string }[]): Prisma.Decimal {
    return cotas.reduce(
      (acc, c) => acc.add(new Prisma.Decimal(c.valor)),
      new Prisma.Decimal('0.00'),
    );
  }

  it('deve dividir R$ 100,00 entre 3 pessoas com resíduo alocado na última cota [33.33, 33.33, 33.34]', () => {
    const cotas = calcularDivisaoPorPessoas('100.00', 3);

    expect(cotas).toHaveLength(3);
    expect(cotas[0].valor).toBe('33.33');
    expect(cotas[1].valor).toBe('33.33');
    expect(cotas[2].valor).toBe('33.34');
    expect(cotas[0].status).toBe('pendente');
    expect(cotas[2].status).toBe('pendente');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('100.00');
  });

  it('deve dividir R$ 10,00 entre 3 pessoas conservando 100% dos centavos [3.33, 3.33, 3.34]', () => {
    const cotas = calcularDivisaoPorPessoas('10.00', 3);

    expect(cotas).toHaveLength(3);
    expect(cotas[0].valor).toBe('3.33');
    expect(cotas[1].valor).toBe('3.33');
    expect(cotas[2].valor).toBe('3.34');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('10.00');
  });

  it('deve dividir R$ 50,00 entre 7 pessoas com 2 centavos de resíduo na última cota', () => {
    const cotas = calcularDivisaoPorPessoas(new Prisma.Decimal('50.00'), 7);

    expect(cotas).toHaveLength(7);
    for (let i = 0; i < 6; i++) {
      expect(cotas[i].valor).toBe('7.14');
    }
    expect(cotas[6].valor).toBe('7.16');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('50.00');
  });

  it('deve dividir R$ 1,00 entre 3 pessoas gerando [0.33, 0.33, 0.34]', () => {
    const cotas = calcularDivisaoPorPessoas('1.00', 3);

    expect(cotas).toHaveLength(3);
    expect(cotas[0].valor).toBe('0.33');
    expect(cotas[1].valor).toBe('0.33');
    expect(cotas[2].valor).toBe('0.34');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('1.00');
  });

  it('deve dividir R$ 20,00 entre 6 pessoas garantindo soma exata', () => {
    const cotas = calcularDivisaoPorPessoas('20.00', 6);

    expect(cotas).toHaveLength(6);
    for (let i = 0; i < 5; i++) {
      expect(cotas[i].valor).toBe('3.33');
    }
    expect(cotas[5].valor).toBe('3.35');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('20.00');
  });

  it('deve dividir R$ 100,00 entre 9 pessoas conservando centavos exatos', () => {
    const cotas = calcularDivisaoPorPessoas('100.00', 9);

    expect(cotas).toHaveLength(9);
    for (let i = 0; i < 8; i++) {
      expect(cotas[i].valor).toBe('11.11');
    }
    expect(cotas[8].valor).toBe('11.12');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('100.00');
  });

  it('deve dividir R$ 77,77 entre 3 pessoas com resíduo na última cota [25.92, 25.92, 25.93]', () => {
    const cotas = calcularDivisaoPorPessoas('77.77', 3);

    expect(cotas).toHaveLength(3);
    expect(cotas[0].valor).toBe('25.92');
    expect(cotas[1].valor).toBe('25.92');
    expect(cotas[2].valor).toBe('25.93');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('77.77');
  });

  it('deve dividir R$ 0,05 entre 2 pessoas gerando [0.02, 0.03]', () => {
    const cotas = calcularDivisaoPorPessoas('0.05', 2);

    expect(cotas).toHaveLength(2);
    expect(cotas[0].valor).toBe('0.02');
    expect(cotas[1].valor).toBe('0.03');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('0.05');
  });

  it('deve dividir R$ 0,01 entre 2 pessoas gerando [0.00, 0.01]', () => {
    const cotas = calcularDivisaoPorPessoas('0.01', 2);

    expect(cotas).toHaveLength(2);
    expect(cotas[0].valor).toBe('0.00');
    expect(cotas[1].valor).toBe('0.01');

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('0.01');
  });

  it('deve dividir perfeitamente quando não há resíduo (ex: R$ 100,00 entre 4 pessoas)', () => {
    const cotas = calcularDivisaoPorPessoas('100.00', 4);

    expect(cotas).toHaveLength(4);
    for (const cota of cotas) {
      expect(cota.valor).toBe('25.00');
    }

    const soma = somarCotas(cotas);
    expect(soma.toFixed(2)).toBe('100.00');
  });

  it('deve lançar erro DIVISAO_INVALIDA se quantidade de pessoas for menor que 2', () => {
    expect(() => calcularDivisaoPorPessoas('100.00', 1)).toThrowError(ErroDominio);
    try {
      calcularDivisaoPorPessoas('100.00', 0);
    } catch (err) {
      expect(err).toBeInstanceOf(ErroDominio);
      expect((err as ErroDominio).codigo).toBe('DIVISAO_INVALIDA');
    }
  });

  it('deve lançar erro DIVISAO_INVALIDA se quantidade de pessoas não for inteiro', () => {
    expect(() => calcularDivisaoPorPessoas('100.00', 2.5)).toThrowError(ErroDominio);
  });

  it('deve lançar erro DIVISAO_INVALIDA se valor total for menor ou igual a zero', () => {
    expect(() => calcularDivisaoPorPessoas('0.00', 2)).toThrowError(ErroDominio);
    expect(() => calcularDivisaoPorPessoas('-10.00', 2)).toThrowError(ErroDominio);
  });
});

describe('Split Payment Calculator — Divisão por Itens (Story 15.3, RN19)', () => {
  const itensComanda: ItemComandaParaDivisao[] = [
    {
      item_comanda_id: 101,
      nome: 'Hambúrguer Artesanal',
      preco_unitario: '29.90',
      quantidade: 2,
    },
    {
      item_comanda_id: 102,
      nome: 'Refrigerante Lata',
      preco_unitario: '6.00',
      quantidade: 2,
    },
  ];

  it('deve dividir itens entre 2 clientes com taxa de 10% conservando centavos exatos', () => {
    // Total esperado: (29.90*2 + 6.00*2) = 59.80 + 12.00 = 71.80 + 10% (7.18) = 78.98
    const cotasConfig = [
      {
        rotulo: 'Cliente A',
        itens: [
          { item_comanda_id: 101, quantidade: 1 },
          { item_comanda_id: 102, quantidade: 1 },
        ],
      },
      {
        rotulo: 'Cliente B',
        itens: [
          { item_comanda_id: 101, quantidade: 1 },
          { item_comanda_id: 102, quantidade: 1 },
        ],
      },
    ];

    const resultado = calcularDivisaoPorItens(itensComanda, cotasConfig, true, '78.98');

    expect(resultado).toHaveLength(2);
    expect(resultado[0].subtotal).toBe('35.90');
    expect(resultado[0].taxa_servico).toBe('3.59');
    expect(resultado[0].valor).toBe('39.49');

    expect(resultado[1].subtotal).toBe('35.90');
    expect(resultado[1].taxa_servico).toBe('3.59');
    expect(resultado[1].valor).toBe('39.49');

    const soma = new Prisma.Decimal(resultado[0].valor).add(new Prisma.Decimal(resultado[1].valor));
    expect(soma.toFixed(2)).toBe('78.98');
  });

  it('deve ajustar resíduo de centavo na taxa da última cota quando há dízima na taxa individual', () => {
    // Exemplo: 3 itens de 1.05. Subtotal = 3.15. Taxa 10% de 3.15 = 0.32 (ROUND_HALF_UP). Total = 3.47.
    // Individualmente: 1 item de 1.05 -> taxa 10% de 1.05 = 0.11 (ROUND_HALF_UP). Total cota = 1.16.
    // 3 cotas * 1.16 = 3.48 (diferença de +0.01).
    // O calculador deve deduzir o centavo excedente da última cota para somar exatamente 3.47.
    const itens: ItemComandaParaDivisao[] = [
      { item_comanda_id: 1, nome: 'Café Expresso', preco_unitario: '1.05', quantidade: 3 },
    ];
    const cotasCfg = [
      { rotulo: 'Pessoa 1', itens: [{ item_comanda_id: 1, quantidade: 1 }] },
      { rotulo: 'Pessoa 2', itens: [{ item_comanda_id: 1, quantidade: 1 }] },
      { rotulo: 'Pessoa 3', itens: [{ item_comanda_id: 1, quantidade: 1 }] },
    ];

    const resultado = calcularDivisaoPorItens(itens, cotasCfg, true, '3.47');

    expect(resultado).toHaveLength(3);
    const soma = resultado.reduce(
      (acc, c) => acc.add(new Prisma.Decimal(c.valor)),
      new Prisma.Decimal('0.00'),
    );
    expect(soma.toFixed(2)).toBe('3.47');
  });

  it('deve dividir itens sem taxa de serviço (aplicarTaxaServico = false)', () => {
    const cotasConfig = [
      {
        rotulo: 'Cliente A',
        itens: [{ item_comanda_id: 101, quantidade: 2 }],
      },
      {
        rotulo: 'Cliente B',
        itens: [{ item_comanda_id: 102, quantidade: 2 }],
      },
    ];

    const resultado = calcularDivisaoPorItens(itensComanda, cotasConfig, false, '71.80');

    expect(resultado[0].subtotal).toBe('59.80');
    expect(resultado[0].taxa_servico).toBe('0.00');
    expect(resultado[0].valor).toBe('59.80');

    expect(resultado[1].subtotal).toBe('12.00');
    expect(resultado[1].taxa_servico).toBe('0.00');
    expect(resultado[1].valor).toBe('12.00');

    const soma = new Prisma.Decimal(resultado[0].valor).add(new Prisma.Decimal(resultado[1].valor));
    expect(soma.toFixed(2)).toBe('71.80');
  });

  it('deve lançar erro se item da cota não existir na comanda', () => {
    const cotasConfig = [
      {
        rotulo: 'Cliente A',
        itens: [{ item_comanda_id: 999, quantidade: 1 }],
      },
    ];

    expect(() => calcularDivisaoPorItens(itensComanda, cotasConfig, false)).toThrowError(
      ErroDominio,
    );
  });

  it('deve lançar erro se quantidade alocada exceder o disponível na comanda', () => {
    const cotasConfig = [
      {
        rotulo: 'Cliente A',
        itens: [{ item_comanda_id: 101, quantidade: 2 }],
      },
      {
        rotulo: 'Cliente B',
        itens: [{ item_comanda_id: 101, quantidade: 1 }], // Total 3, mas comanda só tem 2
      },
    ];

    expect(() => calcularDivisaoPorItens(itensComanda, cotasConfig, false)).toThrowError(
      ErroDominio,
    );
  });

  it('deve lançar erro se cota não contiver itens', () => {
    const cotasConfig = [
      {
        rotulo: 'Cliente Vazio',
        itens: [],
      },
    ];

    expect(() => calcularDivisaoPorItens(itensComanda, cotasConfig, false)).toThrowError(
      ErroDominio,
    );
  });
});
