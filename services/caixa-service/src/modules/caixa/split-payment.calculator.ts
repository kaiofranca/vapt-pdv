import { Prisma } from '@prisma/client';
import { ErroDominio } from '../../shared/erros';

export interface CotaCalculada {
  numero_cota: number;
  rotulo: string;
  valor: string;
  saldo: string;
  status: 'pendente';
}

export interface ItemComandaParaDivisao {
  item_comanda_id: number;
  produto_id?: number;
  nome: string;
  preco_unitario: Prisma.Decimal | string | number;
  quantidade: number;
}

export interface ItemSelecionadoCota {
  item_comanda_id: number;
  quantidade: number;
}

export interface ConfigCotaItens {
  rotulo?: string;
  itens: ItemSelecionadoCota[];
}

export interface DetalheItemCota {
  item_comanda_id: number;
  nome: string;
  quantidade: number;
  preco_unitario: string;
  subtotal: string;
}

export interface CotaCalculadaItens {
  numero_cota: number;
  rotulo: string;
  itens: DetalheItemCota[];
  subtotal: string;
  taxa_servico: string;
  valor: string;
  saldo: string;
  status: 'pendente';
}

/**
 * Motor de Divisão de Conta por Pessoas (Split Payment - RN19).
 * Realiza divisão com precisão em centavos inteiros e garantia estrita
 * de conservação de 100% dos centavos (soma(cotas) === total).
 * Resíduos de arredondamento são alocados integralmente na última cota.
 */
export function calcularDivisaoPorPessoas(
  valorTotal: Prisma.Decimal | string | number,
  pessoas: number,
): CotaCalculada[] {
  if (!Number.isInteger(pessoas) || pessoas < 2) {
    throw ErroDominio.divisaoInvalida('A divisão por pessoas requer pelo menos 2 pessoas.', {
      pessoas: 'A quantidade de pessoas deve ser um número inteiro maior ou igual a 2.',
    });
  }

  const totalDecimal =
    valorTotal instanceof Prisma.Decimal
      ? valorTotal
      : new Prisma.Decimal(String(valorTotal));

  if (totalDecimal.lte(0)) {
    throw ErroDominio.divisaoInvalida('O valor a ser dividido deve ser maior que zero.', {
      valor: 'O valor da conta deve ser positivo.',
    });
  }

  // Converter para centavos exatos (inteiro) via Prisma.Decimal (ROUND_HALF_UP)
  const totalCentavos = totalDecimal
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();

  const baseCentavos = Math.floor(totalCentavos / pessoas);
  const residuoCentavos = totalCentavos - baseCentavos * pessoas;

  const cotas: CotaCalculada[] = [];

  for (let i = 1; i < pessoas; i++) {
    const valorFormatado = new Prisma.Decimal(baseCentavos).div(100).toFixed(2);
    cotas.push({
      numero_cota: i,
      rotulo: `Pessoa ${i} de ${pessoas}`,
      valor: valorFormatado,
      saldo: valorFormatado,
      status: 'pendente',
    });
  }

  // A última cota absorve o resíduo exato de centavos garantindo conservação de 100% (RN19)
  const ultimaCotaCentavos = baseCentavos + residuoCentavos;
  const valorUltimaCota = new Prisma.Decimal(ultimaCotaCentavos).div(100).toFixed(2);

  cotas.push({
    numero_cota: pessoas,
    rotulo: `Pessoa ${pessoas} de ${pessoas}`,
    valor: valorUltimaCota,
    saldo: valorUltimaCota,
    status: 'pendente',
  });

  return cotas;
}

/**
 * Motor de Divisão de Conta por Itens Selecionados (Split Payment - RN19).
 * Calcula subtotal, taxa de serviço proporcional opcional (10% com ROUND_HALF_UP)
 * e garante que, ao alocar todos os itens da comanda, a soma das cotas
 * seja exatamente igual ao total da comanda, ajustando resíduo na última cota.
 */
export function calcularDivisaoPorItens(
  itensComanda: ItemComandaParaDivisao[],
  cotasConfig: ConfigCotaItens[],
  aplicarTaxaServico = false,
  totalEsperado?: Prisma.Decimal | string | number,
): CotaCalculadaItens[] {
  if (!Array.isArray(cotasConfig) || cotasConfig.length < 1) {
    throw ErroDominio.divisaoInvalida('A divisão por itens requer a definição de pelo menos uma cota.', {
      cotas: 'Informe pelo menos uma cota com itens selecionados.',
    });
  }

  const mapaItens = new Map<number, ItemComandaParaDivisao>();
  for (const item of itensComanda) {
    mapaItens.set(item.item_comanda_id, item);
  }

  const qtdAlocadaPorItem = new Map<number, number>();
  const cotasCalculadas: CotaCalculadaItens[] = [];
  let somaTotais = new Prisma.Decimal(0);

  for (let idx = 0; idx < cotasConfig.length; idx++) {
    const cotaCfg = cotasConfig[idx];
    const numeroCota = idx + 1;
    const rotulo = cotaCfg.rotulo?.trim() || `Pessoa ${numeroCota}`;

    if (!Array.isArray(cotaCfg.itens) || cotaCfg.itens.length === 0) {
      throw ErroDominio.divisaoInvalida(`A cota "${rotulo}" deve conter pelo menos um item.`, {
        cota: rotulo,
      });
    }

    let subtotalCota = new Prisma.Decimal(0);
    const itensCotaFormatados: DetalheItemCota[] = [];

    for (const itemSel of cotaCfg.itens) {
      if (!Number.isInteger(itemSel.quantidade) || itemSel.quantidade <= 0) {
        throw ErroDominio.divisaoInvalida(
          `Quantidade inválida para o item ID ${itemSel.item_comanda_id} na cota "${rotulo}".`,
          { item_comanda_id: itemSel.item_comanda_id },
        );
      }

      const itemOrig = mapaItens.get(itemSel.item_comanda_id);
      if (!itemOrig) {
        throw ErroDominio.divisaoInvalida(
          `Item ID ${itemSel.item_comanda_id} não encontrado na comanda.`,
          { item_comanda_id: itemSel.item_comanda_id },
        );
      }

      const alocadoAtual = (qtdAlocadaPorItem.get(itemSel.item_comanda_id) || 0) + itemSel.quantidade;
      if (alocadoAtual > itemOrig.quantidade) {
        throw ErroDominio.divisaoInvalida(
          `A quantidade alocada do item "${itemOrig.nome}" (${alocadoAtual}) excede a quantidade da comanda (${itemOrig.quantidade}).`,
          { item_comanda_id: itemSel.item_comanda_id },
        );
      }
      qtdAlocadaPorItem.set(itemSel.item_comanda_id, alocadoAtual);

      const precoItemDecimal =
        itemOrig.preco_unitario instanceof Prisma.Decimal
          ? itemOrig.preco_unitario
          : new Prisma.Decimal(String(itemOrig.preco_unitario));

      const subtotalItem = precoItemDecimal.mul(itemSel.quantidade);
      subtotalCota = subtotalCota.add(subtotalItem);

      itensCotaFormatados.push({
        item_comanda_id: itemSel.item_comanda_id,
        nome: itemOrig.nome,
        quantidade: itemSel.quantidade,
        preco_unitario: precoItemDecimal.toFixed(2),
        subtotal: subtotalItem.toFixed(2),
      });
    }

    let taxaCota = new Prisma.Decimal('0.00');
    if (aplicarTaxaServico) {
      taxaCota = subtotalCota
        .mul(new Prisma.Decimal('0.10'))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
    const totalCota = subtotalCota.add(taxaCota);

    somaTotais = somaTotais.add(totalCota);

    cotasCalculadas.push({
      numero_cota: numeroCota,
      rotulo,
      itens: itensCotaFormatados,
      subtotal: subtotalCota.toFixed(2),
      taxa_servico: taxaCota.toFixed(2),
      valor: totalCota.toFixed(2),
      saldo: totalCota.toFixed(2),
      status: 'pendente',
    });
  }

  // Conservação de 100% dos centavos quando o total esperado da comanda é conhecido
  // e todos os itens foram inteiramente distribuídos (RN19)
  if (totalEsperado !== undefined && totalEsperado !== null) {
    const totalEsperadoDecimal =
      totalEsperado instanceof Prisma.Decimal
        ? totalEsperado
        : new Prisma.Decimal(String(totalEsperado));

    let todosDistribuidos = true;
    for (const item of itensComanda) {
      if ((qtdAlocadaPorItem.get(item.item_comanda_id) || 0) !== item.quantidade) {
        todosDistribuidos = false;
        break;
      }
    }

    if (todosDistribuidos && cotasCalculadas.length > 0) {
      const diferenca = totalEsperadoDecimal.sub(somaTotais);
      if (!diferenca.isZero()) {
        const ultimaCota = cotasCalculadas[cotasCalculadas.length - 1];
        const novoValor = new Prisma.Decimal(ultimaCota.valor).add(diferenca);
        const novaTaxa = new Prisma.Decimal(ultimaCota.taxa_servico).add(diferenca);

        ultimaCota.taxa_servico = novaTaxa.toFixed(2);
        ultimaCota.valor = novoValor.toFixed(2);
        ultimaCota.saldo = novoValor.toFixed(2);
      }
    }
  }

  return cotasCalculadas;
}
