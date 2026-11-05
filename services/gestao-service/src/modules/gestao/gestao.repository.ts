import { Prisma, PrismaClient } from '@prisma/client';

export interface ResumoDiarioDto {
  data: string;
  total_vendas: string;
  total_subtotal: string;
  total_taxa_servico: string;
  quantidade_pedidos: number;
  ticket_medio: string;
  por_forma_pagamento: {
    pix: string;
    cartao: string;
    dinheiro: string;
  };
}

export interface ProdutoAbcDto {
  posicao: number;
  produto_id: number;
  nome_produto: string;
  categoria: string;
  quantidade_vendida: number;
  receita_gerada: string;
  percentual_receita: string;
  percentual_acumulado: string;
  classe_abc: 'A' | 'B' | 'C';
}

export interface DesempenhoGarcomDto {
  garcom_id: number;
  garcom_nome: string;
  comandas_atendidas: number;
  total_vendido: string;
  comissao_gerada: string;
  ticket_medio: string;
}

export interface AlertaEstoqueDto {
  produto_id: number;
  nome_produto: string;
  categoria: string;
  estoque_atual: number;
  estoque_minimo: number;
  nivel: 'baixo' | 'zerado';
  ultimo_movimento_em: string;
}

export interface GestaoRepository {
  eventoJaProcessado(eventoId: string): Promise<boolean>;
  registrarEventoProcessado(eventoId: string, evento: string, timestamp?: Date): Promise<void>;
  processarComandaPaga(dados: {
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
  }): Promise<void>;
  processarComandaCancelada(dataReferencia: Date): Promise<void>;
  processarMovimentoEstoque(dados: {
    produtoId: number;
    nome: string;
    categoria: string;
    estoqueAtual: number;
    estoqueMinimo: number;
    timestamp: Date;
  }): Promise<void>;
  obterResumoDiario(dataStr: string): Promise<ResumoDiarioDto | null>;
  obterRankingProdutos(limite?: number, categoria?: string): Promise<{ receitaTotalAcumulada: string; produtos: ProdutoAbcDto[] }>;
  obterDesempenhoGarcons(): Promise<DesempenhoGarcomDto[]>;
  obterAlertasEstoque(): Promise<AlertaEstoqueDto[]>;
  obterFaturamentoHistorico(de?: string, ate?: string): Promise<any[]>;
}

export class PrismaGestaoRepository implements GestaoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async eventoJaProcessado(eventoId: string): Promise<boolean> {
    const registro = await this.prisma.eventoProcessado.findUnique({
      where: { eventoId },
    });
    return !!registro;
  }

  async registrarEventoProcessado(eventoId: string, evento: string, timestamp: Date = new Date()): Promise<void> {
    await this.prisma.eventoProcessado.create({
      data: {
        eventoId,
        evento,
        processadoEm: timestamp,
      },
    });
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
    const dataRef = new Date(dados.dataReferencia);
    dataRef.setUTCHours(0, 0, 0, 0);

    const subtotalDec = new Prisma.Decimal(dados.subtotal || '0.00');
    const taxaDec = new Prisma.Decimal(dados.taxaServico || '0.00');
    const totalDec = new Prisma.Decimal(dados.total || '0.00');
    const formaPagto = (dados.formaPagamento || 'dinheiro').toLowerCase();

    await this.prisma.$transaction(async (tx) => {
      // 1. Atualizar ou Criar Faturamento Diário
      const faturamentoAtual = await tx.faturamentoDiario.findUnique({
        where: { dataReferencia: dataRef },
      });

      if (!faturamentoAtual) {
        const porForma = { pix: '0.00', cartao: '0.00', dinheiro: '0.00' };
        if (formaPagto in porForma) {
          (porForma as any)[formaPagto] = totalDec.toFixed(2);
        } else {
          porForma.dinheiro = totalDec.toFixed(2);
        }

        await tx.faturamentoDiario.create({
          data: {
            dataReferencia: dataRef,
            comandasPagas: 1,
            comandasCanceladas: 0,
            faturamentoSubtotal: subtotalDec,
            totalTaxaServico: taxaDec,
            faturamentoTotal: totalDec,
            ticketMedio: totalDec,
            porFormaPagamento: porForma,
          },
        });
      } else {
        const comandasPagasNova = faturamentoAtual.comandasPagas + 1;
        const subtotalNovo = faturamentoAtual.faturamentoSubtotal.add(subtotalDec);
        const taxaNova = faturamentoAtual.totalTaxaServico.add(taxaDec);
        const totalNovo = faturamentoAtual.faturamentoTotal.add(totalDec);
        const ticketMedioNovo = totalNovo.dividedBy(comandasPagasNova);

        const porForma = (typeof faturamentoAtual.porFormaPagamento === 'object' && faturamentoAtual.porFormaPagamento !== null
          ? { ...(faturamentoAtual.porFormaPagamento as Record<string, string>) }
          : { pix: '0.00', cartao: '0.00', dinheiro: '0.00' }) as Record<string, string>;

        const valorFormaAtual = new Prisma.Decimal(porForma[formaPagto] || '0.00');
        porForma[formaPagto] = valorFormaAtual.add(totalDec).toFixed(2);

        await tx.faturamentoDiario.update({
          where: { dataReferencia: dataRef },
          data: {
            comandasPagas: comandasPagasNova,
            faturamentoSubtotal: subtotalNovo,
            totalTaxaServico: taxaNova,
            faturamentoTotal: totalNovo,
            ticketMedio: ticketMedioNovo,
            porFormaPagamento: porForma,
          },
        });
      }

      // 2. Atualizar Vendas dos Produtos
      for (const item of dados.itens) {
        const itemSubtotalDec = new Prisma.Decimal(item.subtotal || '0.00');
        await tx.vendasProdutoAbc.upsert({
          where: { produtoId: item.produto_id },
          create: {
            produtoId: item.produto_id,
            nomeProduto: item.nome,
            categoria: item.categoria || 'Geral',
            quantidadeVendida: item.quantidade,
            receitaGerada: itemSubtotalDec,
            classeAbc: 'C',
          },
          update: {
            quantidadeVendida: { increment: item.quantidade },
            receitaGerada: { increment: itemSubtotalDec },
          },
        });
      }

      // 3. Atualizar Desempenho do Garçom
      if (dados.garcomId) {
        const garcomAtual = await tx.desempenhoGarcom.findUnique({
          where: { garcomId: dados.garcomId },
        });

        if (!garcomAtual) {
          await tx.desempenhoGarcom.create({
            data: {
              garcomId: dados.garcomId,
              nomeGarcom: dados.garcomNome || `Garçom #${dados.garcomId}`,
              comandasAtendidas: 1,
              vendasSubtotal: subtotalDec,
              taxaServicoGerada: taxaDec,
              ticketMedioMesa: subtotalDec,
            },
          });
        } else {
          const comandasNovas = garcomAtual.comandasAtendidas + 1;
          const vendasNovas = garcomAtual.vendasSubtotal.add(subtotalDec);
          const taxaNova = garcomAtual.taxaServicoGerada.add(taxaDec);
          const ticketMedioNovo = vendasNovas.dividedBy(comandasNovas);

          await tx.desempenhoGarcom.update({
            where: { garcomId: dados.garcomId },
            data: {
              nomeGarcom: dados.garcomNome || garcomAtual.nomeGarcom,
              comandasAtendidas: comandasNovas,
              vendasSubtotal: vendasNovas,
              taxaServicoGerada: taxaNova,
              ticketMedioMesa: ticketMedioNovo,
            },
          });
        }
      }

      // 4. Recalcular Curva ABC de todos os produtos
      const todosProdutos = await tx.vendasProdutoAbc.findMany({
        orderBy: [{ receitaGerada: 'desc' }, { produtoId: 'asc' }],
      });

      let receitaTotalGeral = new Prisma.Decimal('0.00');
      for (const p of todosProdutos) {
        receitaTotalGeral = receitaTotalGeral.add(p.receitaGerada);
      }

      if (!receitaTotalGeral.isZero()) {
        let acumulado = new Prisma.Decimal('0.00');
        for (const p of todosProdutos) {
          acumulado = acumulado.add(p.receitaGerada);
          const pctAcumulado = acumulado.dividedBy(receitaTotalGeral).toNumber() * 100;
          let classe: 'A' | 'B' | 'C' = 'C';
          if (pctAcumulado <= 80.00) {
            classe = 'A';
          } else if (pctAcumulado <= 95.00) {
            classe = 'B';
          } else {
            classe = 'C';
          }

          if (p.classeAbc !== classe) {
            await tx.vendasProdutoAbc.update({
              where: { produtoId: p.produtoId },
              data: { classeAbc: classe },
            });
          }
        }
      }
    });
  }

  async processarComandaCancelada(dataReferencia: Date): Promise<void> {
    const dataRef = new Date(dataReferencia);
    dataRef.setUTCHours(0, 0, 0, 0);

    await this.prisma.faturamentoDiario.upsert({
      where: { dataReferencia: dataRef },
      create: {
        dataReferencia: dataRef,
        comandasPagas: 0,
        comandasCanceladas: 1,
        faturamentoSubtotal: new Prisma.Decimal('0.00'),
        totalTaxaServico: new Prisma.Decimal('0.00'),
        faturamentoTotal: new Prisma.Decimal('0.00'),
        ticketMedio: new Prisma.Decimal('0.00'),
        porFormaPagamento: { pix: '0.00', cartao: '0.00', dinheiro: '0.00' },
      },
      update: {
        comandasCanceladas: { increment: 1 },
      },
    });
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
      const nivel: 'zerado' | 'baixo' = dados.estoqueAtual <= 0 ? 'zerado' : 'baixo';
      await this.prisma.alertaEstoque.upsert({
        where: { produtoId: dados.produtoId },
        create: {
          produtoId: dados.produtoId,
          nome: dados.nome,
          categoria: dados.categoria || 'Geral',
          estoqueAtual: dados.estoqueAtual,
          estoqueMinimo: dados.estoqueMinimo,
          nivelCriticidade: nivel,
          ultimoMovimentoEm: dados.timestamp,
        },
        update: {
          nome: dados.nome,
          categoria: dados.categoria || 'Geral',
          estoqueAtual: dados.estoqueAtual,
          estoqueMinimo: dados.estoqueMinimo,
          nivelCriticidade: nivel,
          ultimoMovimentoEm: dados.timestamp,
        },
      });
    } else {
      // Se subiu acima do mínimo, remove do painel de alertas
      try {
        await this.prisma.alertaEstoque.delete({
          where: { produtoId: dados.produtoId },
        });
      } catch {
        // Ignora se não existia
      }
    }
  }

  async obterResumoDiario(dataStr: string): Promise<ResumoDiarioDto | null> {
    const dataRef = new Date(`${dataStr}T00:00:00.000Z`);
    const faturamento = await this.prisma.faturamentoDiario.findUnique({
      where: { dataReferencia: dataRef },
    });

    if (!faturamento) {
      return null;
    }

    const porForma = (typeof faturamento.porFormaPagamento === 'object' && faturamento.porFormaPagamento !== null
      ? faturamento.porFormaPagamento
      : { pix: '0.00', cartao: '0.00', dinheiro: '0.00' }) as Record<string, string>;

    return {
      data: dataStr,
      total_vendas: faturamento.faturamentoTotal.toFixed(2),
      total_subtotal: faturamento.faturamentoSubtotal.toFixed(2),
      total_taxa_servico: faturamento.totalTaxaServico.toFixed(2),
      quantidade_pedidos: faturamento.comandasPagas,
      ticket_medio: faturamento.ticketMedio.toFixed(2),
      por_forma_pagamento: {
        pix: porForma.pix || '0.00',
        cartao: porForma.cartao || '0.00',
        dinheiro: porForma.dinheiro || '0.00',
      },
    };
  }

  async obterRankingProdutos(limite = 20, categoria?: string): Promise<{ receitaTotalAcumulada: string; produtos: ProdutoAbcDto[] }> {
    const whereClause: Prisma.VendasProdutoAbcWhereInput = categoria
      ? { categoria: { equals: categoria, mode: 'insensitive' } }
      : {};

    const produtos = await this.prisma.vendasProdutoAbc.findMany({
      where: whereClause,
      orderBy: [{ receitaGerada: 'desc' }, { produtoId: 'asc' }],
      take: limite,
    });

    const todosProdutos = await this.prisma.vendasProdutoAbc.findMany({
      where: whereClause,
      orderBy: [{ receitaGerada: 'desc' }, { produtoId: 'asc' }],
    });

    let receitaTotalGeral = new Prisma.Decimal('0.00');
    for (const p of todosProdutos) {
      receitaTotalGeral = receitaTotalGeral.add(p.receitaGerada);
    }

    let acumulado = new Prisma.Decimal('0.00');
    const itensDto: ProdutoAbcDto[] = [];

    for (let i = 0; i < produtos.length; i++) {
      const p = produtos[i];
      acumulado = acumulado.add(p.receitaGerada);

      const percentualReceita = !receitaTotalGeral.isZero()
        ? p.receitaGerada.dividedBy(receitaTotalGeral).toNumber() * 100
        : 0;

      const percentualAcumulado = !receitaTotalGeral.isZero()
        ? acumulado.dividedBy(receitaTotalGeral).toNumber() * 100
        : 0;

      itensDto.push({
        posicao: i + 1,
        produto_id: p.produtoId,
        nome_produto: p.nomeProduto,
        categoria: p.categoria,
        quantidade_vendida: p.quantidadeVendida,
        receita_gerada: p.receitaGerada.toFixed(2),
        percentual_receita: percentualReceita.toFixed(2),
        percentual_acumulado: percentualAcumulado.toFixed(2),
        classe_abc: (p.classeAbc as 'A' | 'B' | 'C') || 'C',
      });
    }

    return {
      receitaTotalAcumulada: receitaTotalGeral.toFixed(2),
      produtos: itensDto,
    };
  }

  async obterDesempenhoGarcons(): Promise<DesempenhoGarcomDto[]> {
    const garcons = await this.prisma.desempenhoGarcom.findMany({
      orderBy: [{ vendasSubtotal: 'desc' }, { garcomId: 'asc' }],
    });

    return garcons.map((g) => ({
      garcom_id: g.garcomId,
      garcom_nome: g.nomeGarcom,
      comandas_atendidas: g.comandasAtendidas,
      total_vendido: g.vendasSubtotal.toFixed(2),
      comissao_gerada: g.taxaServicoGerada.toFixed(2),
      ticket_medio: g.ticketMedioMesa.toFixed(2),
    }));
  }

  async obterAlertasEstoque(): Promise<AlertaEstoqueDto[]> {
    const alertas = await this.prisma.alertaEstoque.findMany({
      orderBy: [
        { nivelCriticidade: 'desc' }, // 'zerado' antes de 'baixo'
        { estoqueAtual: 'asc' },
      ],
    });

    return alertas.map((a) => ({
      produto_id: a.produtoId,
      nome_produto: a.nome,
      categoria: a.categoria,
      estoque_atual: a.estoqueAtual,
      estoque_minimo: a.estoqueMinimo,
      nivel: a.nivelCriticidade as 'baixo' | 'zerado',
      ultimo_movimento_em: a.ultimoMovimentoEm.toISOString(),
    }));
  }

  async obterFaturamentoHistorico(de?: string, ate?: string): Promise<any[]> {
    const where: Prisma.FaturamentoDiarioWhereInput = {};
    if (de || ate) {
      where.dataReferencia = {};
      if (de) where.dataReferencia.gte = new Date(`${de}T00:00:00.000Z`);
      if (ate) where.dataReferencia.lte = new Date(`${ate}T23:59:59.999Z`);
    }

    const registros = await this.prisma.faturamentoDiario.findMany({
      where,
      orderBy: { dataReferencia: 'asc' },
    });

    return registros.map((r) => {
      const porForma = (typeof r.porFormaPagamento === 'object' && r.porFormaPagamento !== null
        ? r.porFormaPagamento
        : {}) as Record<string, string>;

      return {
        data: r.dataReferencia.toISOString().split('T')[0],
        comandas_pagas: r.comandasPagas,
        comandas_canceladas: r.comandasCanceladas,
        faturamento_subtotal: r.faturamentoSubtotal.toFixed(2),
        total_taxa_servico: r.totalTaxaServico.toFixed(2),
        faturamento_total: r.faturamentoTotal.toFixed(2),
        ticket_medio: r.ticketMedio.toFixed(2),
        pix: porForma.pix || '0.00',
        cartao: porForma.cartao || '0.00',
        dinheiro: porForma.dinheiro || '0.00',
      };
    });
  }
}
