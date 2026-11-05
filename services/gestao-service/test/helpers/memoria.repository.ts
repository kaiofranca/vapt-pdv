import { Prisma } from '@prisma/client';
import {
  GestaoRepository,
  ResumoDiarioDto,
  ProdutoAbcDto,
  DesempenhoGarcomDto,
  AlertaEstoqueDto,
} from '../../src/modules/gestao/gestao.repository';

interface FaturamentoMemoria {
  comandasPagas: number;
  comandasCanceladas: number;
  subtotal: Prisma.Decimal;
  taxa: Prisma.Decimal;
  total: Prisma.Decimal;
  porForma: {
    pix: Prisma.Decimal;
    cartao: Prisma.Decimal;
    dinheiro: Prisma.Decimal;
  };
}

interface ProdutoMemoria {
  produto_id: number;
  nome_produto: string;
  categoria: string;
  quantidade_vendida: number;
  receita_gerada: Prisma.Decimal;
  classe_abc: 'A' | 'B' | 'C';
}

interface GarcomMemoria {
  garcom_id: number;
  garcom_nome: string;
  comandas_atendidas: number;
  total_vendido: Prisma.Decimal;
  taxa_gerada: Prisma.Decimal;
}

export class MemoriaGestaoRepository implements GestaoRepository {
  private eventosProcessados = new Set<string>();
  private faturamentos = new Map<string, FaturamentoMemoria>();
  private produtos = new Map<number, ProdutoMemoria>();
  private garcons = new Map<number, GarcomMemoria>();
  private alertas = new Map<number, any>();

  async eventoJaProcessado(eventoId: string): Promise<boolean> {
    return this.eventosProcessados.has(eventoId);
  }

  async registrarEventoProcessado(eventoId: string, _evento: string, _timestamp?: Date): Promise<void> {
    this.eventosProcessados.add(eventoId);
  }

  async processarComandaPaga(dados: {
    dataReferencia: Date;
    subtotal: string;
    taxaServico: string;
    total: string;
    formaPagamento: string;
    garcomId?: number;
    garcomNome?: string;
    itens: Array<{
      produto_id: number;
      nome: string;
      categoria: string;
      quantidade: number;
      subtotal: string;
    }>;
  }): Promise<void> {
    const dataStr = dados.dataReferencia.toISOString().split('T')[0];
    const subtotalDec = new Prisma.Decimal(dados.subtotal || '0.00');
    const taxaDec = new Prisma.Decimal(dados.taxaServico || '0.00');
    const totalDec = new Prisma.Decimal(dados.total || '0.00');
    const forma = (dados.formaPagamento || 'dinheiro').toLowerCase();

    // 1. Faturamento
    const fatAtual = this.faturamentos.get(dataStr) || {
      comandasPagas: 0,
      comandasCanceladas: 0,
      subtotal: new Prisma.Decimal('0.00'),
      taxa: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('0.00'),
      porForma: {
        pix: new Prisma.Decimal('0.00'),
        cartao: new Prisma.Decimal('0.00'),
        dinheiro: new Prisma.Decimal('0.00'),
      },
    };

    fatAtual.comandasPagas += 1;
    fatAtual.subtotal = fatAtual.subtotal.add(subtotalDec);
    fatAtual.taxa = fatAtual.taxa.add(taxaDec);
    fatAtual.total = fatAtual.total.add(totalDec);

    if (forma in fatAtual.porForma) {
      fatAtual.porForma[forma as keyof typeof fatAtual.porForma] =
        fatAtual.porForma[forma as keyof typeof fatAtual.porForma].add(totalDec);
    } else {
      fatAtual.porForma.dinheiro = fatAtual.porForma.dinheiro.add(totalDec);
    }
    this.faturamentos.set(dataStr, fatAtual);

    // 2. Vendas Produtos
    for (const item of dados.itens) {
      const prodAtual = this.produtos.get(item.produto_id) || {
        produto_id: item.produto_id,
        nome_produto: item.nome,
        categoria: item.categoria,
        quantidade_vendida: 0,
        receita_gerada: new Prisma.Decimal('0.00'),
        classe_abc: 'C' as const,
      };
      prodAtual.quantidade_vendida += item.quantidade;
      prodAtual.receita_gerada = prodAtual.receita_gerada.add(new Prisma.Decimal(item.subtotal || '0.00'));
      this.produtos.set(item.produto_id, prodAtual);
    }

    // Recalcular ABC com ordenação secundária por produto_id (desempate determinístico)
    const todosProds = Array.from(this.produtos.values()).sort((a, b) => {
      const diff = b.receita_gerada.sub(a.receita_gerada).toNumber();
      if (diff !== 0) return diff;
      return a.produto_id - b.produto_id;
    });

    let totalReceita = new Prisma.Decimal('0.00');
    for (const p of todosProds) {
      totalReceita = totalReceita.add(p.receita_gerada);
    }

    if (!totalReceita.isZero()) {
      let acum = new Prisma.Decimal('0.00');
      for (const p of todosProds) {
        acum = acum.add(p.receita_gerada);
        const pct = (acum.dividedBy(totalReceita).toNumber()) * 100;
        if (pct <= 80.001) {
          p.classe_abc = 'A';
        } else if (pct <= 95.001) {
          p.classe_abc = 'B';
        } else {
          p.classe_abc = 'C';
        }
      }
    }

    // 3. Garçom
    if (dados.garcomId) {
      const garcAtual = this.garcons.get(dados.garcomId) || {
        garcom_id: dados.garcomId,
        garcom_nome: dados.garcomNome || `Garçom #${dados.garcomId}`,
        comandas_atendidas: 0,
        total_vendido: new Prisma.Decimal('0.00'),
        taxa_gerada: new Prisma.Decimal('0.00'),
      };
      garcAtual.comandas_atendidas += 1;
      garcAtual.total_vendido = garcAtual.total_vendido.add(subtotalDec);
      garcAtual.taxa_gerada = garcAtual.taxa_gerada.add(taxaDec);
      this.garcons.set(dados.garcomId, garcAtual);
    }
  }

  async processarComandaCancelada(dataReferencia: Date): Promise<void> {
    const dataStr = dataReferencia.toISOString().split('T')[0];
    const fatAtual = this.faturamentos.get(dataStr) || {
      comandasPagas: 0,
      comandasCanceladas: 0,
      subtotal: new Prisma.Decimal('0.00'),
      taxa: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('0.00'),
      porForma: {
        pix: new Prisma.Decimal('0.00'),
        cartao: new Prisma.Decimal('0.00'),
        dinheiro: new Prisma.Decimal('0.00'),
      },
    };
    fatAtual.comandasCanceladas += 1;
    this.faturamentos.set(dataStr, fatAtual);
  }

  async processarMovimentoEstoque(dados: {
    produtoId: number;
    nome: string;
    categoria: string;
    estoqueAtual: number;
    estoqueMinimo: number;
    timestamp: Date;
  }): Promise<void> {
    if (dados.estoqueAtual <= dados.estoqueMinimo) {
      this.alertas.set(dados.produtoId, {
        produto_id: dados.produtoId,
        nome_produto: dados.nome,
        categoria: dados.categoria,
        estoque_atual: dados.estoqueAtual,
        estoque_minimo: dados.estoqueMinimo,
        nivel: dados.estoqueAtual <= 0 ? 'zerado' : 'baixo',
        ultimo_movimento_em: dados.timestamp.toISOString(),
      });
    } else {
      this.alertas.delete(dados.produtoId);
    }
  }

  async obterResumoDiario(dataStr: string): Promise<ResumoDiarioDto | null> {
    const fat = this.faturamentos.get(dataStr);
    if (!fat) return null;

    const ticketMedio =
      fat.comandasPagas > 0
        ? fat.total.dividedBy(fat.comandasPagas).toFixed(2)
        : '0.00';

    return {
      data: dataStr,
      total_vendas: fat.total.toFixed(2),
      total_subtotal: fat.subtotal.toFixed(2),
      total_taxa_servico: fat.taxa.toFixed(2),
      quantidade_pedidos: fat.comandasPagas,
      ticket_medio: ticketMedio,
      por_forma_pagamento: {
        pix: fat.porForma.pix.toFixed(2),
        cartao: fat.porForma.cartao.toFixed(2),
        dinheiro: fat.porForma.dinheiro.toFixed(2),
      },
    };
  }

  async obterRankingProdutos(
    limite = 20,
    categoria?: string,
  ): Promise<{ receitaTotalAcumulada: string; produtos: ProdutoAbcDto[] }> {
    let prods = Array.from(this.produtos.values());
    if (categoria) {
      prods = prods.filter((p) => p.categoria.toLowerCase() === categoria.toLowerCase());
    }

    // Ordenação secundária por produto_id em caso de empate na receita
    prods.sort((a, b) => {
      const diff = b.receita_gerada.sub(a.receita_gerada).toNumber();
      if (diff !== 0) return diff;
      return a.produto_id - b.produto_id;
    });

    let receitaTotal = new Prisma.Decimal('0.00');
    for (const p of prods) {
      receitaTotal = receitaTotal.add(p.receita_gerada);
    }

    let acumulado = new Prisma.Decimal('0.00');
    const resultado: ProdutoAbcDto[] = [];

    const fatiados = prods.slice(0, limite);
    for (let i = 0; i < fatiados.length; i++) {
      const p = fatiados[i];
      acumulado = acumulado.add(p.receita_gerada);

      const pctReceita = !receitaTotal.isZero()
        ? p.receita_gerada.dividedBy(receitaTotal).toNumber() * 100
        : 0;
      const pctAcumulado = !receitaTotal.isZero()
        ? acumulado.dividedBy(receitaTotal).toNumber() * 100
        : 0;

      resultado.push({
        posicao: i + 1,
        produto_id: p.produto_id,
        nome_produto: p.nome_produto,
        categoria: p.categoria,
        quantidade_vendida: p.quantidade_vendida,
        receita_gerada: p.receita_gerada.toFixed(2),
        percentual_receita: pctReceita.toFixed(2),
        percentual_acumulado: pctAcumulado.toFixed(2),
        classe_abc: p.classe_abc,
      });
    }

    return {
      receitaTotalAcumulada: receitaTotal.toFixed(2),
      produtos: resultado,
    };
  }

  async obterDesempenhoGarcons(): Promise<DesempenhoGarcomDto[]> {
    const list = Array.from(this.garcons.values()).sort((a, b) => {
      const diff = b.total_vendido.sub(a.total_vendido).toNumber();
      if (diff !== 0) return diff;
      return a.garcom_id - b.garcom_id;
    });

    return list.map((g) => ({
      garcom_id: g.garcom_id,
      garcom_nome: g.garcom_nome,
      comandas_atendidas: g.comandas_atendidas,
      total_vendido: g.total_vendido.toFixed(2),
      comissao_gerada: g.taxa_gerada.toFixed(2),
      ticket_medio:
        g.comandas_atendidas > 0
          ? g.total_vendido.dividedBy(g.comandas_atendidas).toFixed(2)
          : '0.00',
    }));
  }

  async obterAlertasEstoque(): Promise<AlertaEstoqueDto[]> {
    return Array.from(this.alertas.values()).sort((a, b) => {
      if (a.nivel === 'zerado' && b.nivel !== 'zerado') return -1;
      if (a.nivel !== 'zerado' && b.nivel === 'zerado') return 1;
      return a.estoque_atual - b.estoque_atual;
    });
  }

  async obterFaturamentoHistorico(de?: string, ate?: string): Promise<any[]> {
    const datas = Array.from(this.faturamentos.keys()).sort();
    const filtradas = datas.filter((d) => (!de || d >= de) && (!ate || d <= ate));

    return filtradas.map((d) => {
      const fat = this.faturamentos.get(d)!;
      const ticket =
        fat.comandasPagas > 0
          ? fat.total.dividedBy(fat.comandasPagas).toFixed(2)
          : '0.00';

      return {
        data: d,
        comandas_pagas: fat.comandasPagas,
        comandas_canceladas: fat.comandasCanceladas,
        faturamento_subtotal: fat.subtotal.toFixed(2),
        total_taxa_servico: fat.taxa.toFixed(2),
        faturamento_total: fat.total.toFixed(2),
        ticket_medio: ticket,
        pix: fat.porForma.pix.toFixed(2),
        cartao: fat.porForma.cartao.toFixed(2),
        dinheiro: fat.porForma.dinheiro.toFixed(2),
      };
    });
  }
}
