import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../../shared/prisma';
import { gravarEventoOutbox } from '../../shared/messaging/outbox.publisher';

export interface ItemSnapshot {
  item_comanda_id: number;
  produto_id: number;
  nome: string;
  categoria?: string;
  preco_unitario: string;
  quantidade: number;
  subtotal: string;
}

export interface PagamentoParcelaRegistro {
  id: number;
  cobrancaId: number;
  comandaId: number;
  numeroParcela: number;
  pagadorLabel: string | null;
  formaPagamento: string;
  valorAplicado: Prisma.Decimal;
  valorRecebido: Prisma.Decimal;
  troco: Prisma.Decimal;
  registradoEm: Date;
}

export interface ReciboVendaRegistro {
  id: number;
  codigoAutenticacao: string;
  comandaId: number;
  cobrancaId: number;
  resumoRecibo: any;
  emitidoEm: Date;
}

export interface CobrancaComandaRegistro {
  id: number;
  comandaId: number;
  mesa: number;
  garcomId: number;
  nomeCliente: string | null;
  status: string;
  aplicarTaxaServico: boolean;
  subtotal: Prisma.Decimal;
  taxaServico: Prisma.Decimal;
  total: Prisma.Decimal;
  valorPago: Prisma.Decimal;
  saldoRestante: Prisma.Decimal;
  trocoTotal: Prisma.Decimal;
  modoDivisao: string;
  quantidadePagadores: number;
  itensSnapshot: any;
  divisaoDetalhes: any | null;
  fechadaEm: Date;
  pagaEm: Date | null;
  pagamentos?: PagamentoParcelaRegistro[];
  recibo?: ReciboVendaRegistro | null;
}

export interface CobrancaFiltros {
  status?: string;
  mesa?: number;
  busca?: string;
  periodo?: string;
}

export interface ResumoTurnoDto {
  aguardando_pagamento: number;
  pagas_hoje: number;
  faturamento_turno: string;
}

export interface CriarCobrancaDados {
  comandaId: number;
  mesa: number;
  garcomId: number;
  nomeCliente?: string | null;
  status?: string;
  aplicarTaxaServico: boolean;
  subtotal: Prisma.Decimal;
  taxaServico: Prisma.Decimal;
  total: Prisma.Decimal;
  valorPago?: Prisma.Decimal;
  saldoRestante: Prisma.Decimal;
  trocoTotal?: Prisma.Decimal;
  modoDivisao?: string;
  quantidadePagadores?: number;
  itensSnapshot: any;
  divisaoDetalhes?: any | null;
  fechadaEm?: Date;
  pagaEm?: Date | null;
}

export interface AtualizarCobrancaDados {
  mesa?: number;
  garcomId?: number;
  nomeCliente?: string | null;
  status?: string;
  aplicarTaxaServico?: boolean;
  subtotal?: Prisma.Decimal;
  taxaServico?: Prisma.Decimal;
  total?: Prisma.Decimal;
  valorPago?: Prisma.Decimal;
  saldoRestante?: Prisma.Decimal;
  trocoTotal?: Prisma.Decimal;
  modoDivisao?: string;
  quantidadePagadores?: number;
  itensSnapshot?: any;
  divisaoDetalhes?: any | null;
  fechadaEm?: Date;
  pagaEm?: Date | null;
}

export interface RegistrarPagamentoDados {
  cobrancaId: number;
  comandaId: number;
  numeroParcela: number;
  pagadorLabel?: string | null;
  formaPagamento: string;
  valorAplicado: Prisma.Decimal;
  valorRecebido: Prisma.Decimal;
  troco: Prisma.Decimal;
  registradoEm?: Date;
}

export interface SalvarReciboDados {
  codigoAutenticacao: string;
  comandaId: number;
  cobrancaId: number;
  resumoRecibo: any;
  emitidoEm?: Date;
}

export interface QuitarComOutboxDados {
  comandaId: number;
  pagamento: RegistrarPagamentoDados;
  atualizacao: AtualizarCobrancaDados;
  recibo: SalvarReciboDados;
  eventoOutbox: {
    id: string;
    tipoEvento: string;
    chaveAgregado: string;
    payload: Record<string, unknown>;
  };
}

export interface QuitarComOutboxResultado {
  parcela: PagamentoParcelaRegistro;
  cobranca: CobrancaComandaRegistro;
  recibo: ReciboVendaRegistro;
}

export interface CobrancasRepository {
  listar(filtros?: CobrancaFiltros): Promise<CobrancaComandaRegistro[]>;
  buscarPorComandaId(comandaId: number): Promise<CobrancaComandaRegistro | null>;
  buscarPorId(id: number): Promise<CobrancaComandaRegistro | null>;
  criar(dados: CriarCobrancaDados): Promise<CobrancaComandaRegistro>;
  atualizar(comandaId: number, dados: AtualizarCobrancaDados): Promise<CobrancaComandaRegistro>;
  obterResumoTurno(): Promise<ResumoTurnoDto>;
  registrarPagamento(dados: RegistrarPagamentoDados): Promise<PagamentoParcelaRegistro>;
  removerPagamento?(comandaId: number, parcelaId: number): Promise<PagamentoParcelaRegistro | null>;
  salvarRecibo(dados: SalvarReciboDados): Promise<ReciboVendaRegistro>;
  buscarReciboPorComandaId(comandaId: number): Promise<ReciboVendaRegistro | null>;
  quitarComOutbox?(dados: QuitarComOutboxDados): Promise<QuitarComOutboxResultado>;
}

export class PrismaCobrancasRepository implements CobrancasRepository {
  constructor(private readonly prisma: ClienteBanco) {}

  async listar(filtros?: CobrancaFiltros): Promise<CobrancaComandaRegistro[]> {
    const where: Prisma.CobrancaComandaWhereInput = {};

    if (filtros?.status) {
      const statusNormalizado = filtros.status.toLowerCase().trim();
      if (statusNormalizado === 'fechada' || statusNormalizado === 'aguardando_pagamento') {
        where.status = 'aguardando_pagamento';
      } else if (statusNormalizado === 'paga') {
        where.status = 'paga';
      } else if (statusNormalizado === 'cancelada') {
        where.status = 'cancelada';
      } else if (statusNormalizado === 'parcialmente_paga') {
        where.status = 'aguardando_pagamento';
        where.valorPago = { gt: new Prisma.Decimal('0.00') };
      }
    }

    if (filtros?.mesa) {
      where.mesa = filtros.mesa;
    }

    if (filtros?.busca) {
      const termo = filtros.busca.trim();
      const mesaNumero = parseInt(termo, 10);

      if (!isNaN(mesaNumero) && String(mesaNumero) === termo) {
        where.OR = [
          { mesa: mesaNumero },
          { nomeCliente: { contains: termo, mode: 'insensitive' } },
        ];
      } else {
        where.nomeCliente = { contains: termo, mode: 'insensitive' };
      }
    }

    if (filtros?.periodo === 'hoje') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      where.fechadaEm = { gte: hoje };
    }

    const registros = await this.prisma.cobrancaComanda.findMany({
      where,
      orderBy: { fechadaEm: 'desc' },
      include: {
        pagamentos: {
          orderBy: { numeroParcela: 'asc' },
        },
        recibo: true,
      },
    });

    return registros as CobrancaComandaRegistro[];
  }

  async buscarPorComandaId(comandaId: number): Promise<CobrancaComandaRegistro | null> {
    const registro = await this.prisma.cobrancaComanda.findUnique({
      where: { comandaId },
      include: {
        pagamentos: {
          orderBy: { numeroParcela: 'asc' },
        },
        recibo: true,
      },
    });

    return (registro as CobrancaComandaRegistro) || null;
  }

  async buscarPorId(id: number): Promise<CobrancaComandaRegistro | null> {
    const registro = await this.prisma.cobrancaComanda.findUnique({
      where: { id },
      include: {
        pagamentos: {
          orderBy: { numeroParcela: 'asc' },
        },
        recibo: true,
      },
    });

    return (registro as CobrancaComandaRegistro) || null;
  }

  async criar(dados: CriarCobrancaDados): Promise<CobrancaComandaRegistro> {
    const criado = await this.prisma.cobrancaComanda.create({
      data: {
        comandaId: dados.comandaId,
        mesa: dados.mesa,
        garcomId: dados.garcomId,
        nomeCliente: dados.nomeCliente ?? null,
        status: dados.status ?? 'aguardando_pagamento',
        aplicarTaxaServico: dados.aplicarTaxaServico,
        subtotal: dados.subtotal,
        taxaServico: dados.taxaServico,
        total: dados.total,
        valorPago: dados.valorPago ?? new Prisma.Decimal('0.00'),
        saldoRestante: dados.saldoRestante,
        trocoTotal: dados.trocoTotal ?? new Prisma.Decimal('0.00'),
        modoDivisao: dados.modoDivisao ?? 'integral',
        quantidadePagadores: dados.quantidadePagadores ?? 1,
        itensSnapshot: dados.itensSnapshot,
        divisaoDetalhes: dados.divisaoDetalhes ?? Prisma.JsonNull,
        fechadaEm: dados.fechadaEm ?? new Date(),
        pagaEm: dados.pagaEm ?? null,
      },
      include: {
        pagamentos: {
          orderBy: { numeroParcela: 'asc' },
        },
        recibo: true,
      },
    });

    return criado as CobrancaComandaRegistro;
  }

  async atualizar(
    comandaId: number,
    dados: AtualizarCobrancaDados,
  ): Promise<CobrancaComandaRegistro> {
    const atualizado = await this.prisma.cobrancaComanda.update({
      where: { comandaId },
      data: {
        mesa: dados.mesa,
        garcomId: dados.garcomId,
        nomeCliente: dados.nomeCliente,
        status: dados.status,
        aplicarTaxaServico: dados.aplicarTaxaServico,
        subtotal: dados.subtotal,
        taxaServico: dados.taxaServico,
        total: dados.total,
        valorPago: dados.valorPago,
        saldoRestante: dados.saldoRestante,
        trocoTotal: dados.trocoTotal,
        modoDivisao: dados.modoDivisao,
        quantidadePagadores: dados.quantidadePagadores,
        itensSnapshot: dados.itensSnapshot,
        divisaoDetalhes: dados.divisaoDetalhes === null ? Prisma.JsonNull : dados.divisaoDetalhes,
        fechadaEm: dados.fechadaEm,
        pagaEm: dados.pagaEm,
      },
      include: {
        pagamentos: {
          orderBy: { numeroParcela: 'asc' },
        },
        recibo: true,
      },
    });

    return atualizado as CobrancaComandaRegistro;
  }

  async registrarPagamento(
    dados: RegistrarPagamentoDados,
  ): Promise<PagamentoParcelaRegistro> {
    const criado = await this.prisma.pagamentoParcela.create({
      data: {
        cobrancaId: dados.cobrancaId,
        comandaId: dados.comandaId,
        numeroParcela: dados.numeroParcela,
        pagadorLabel: dados.pagadorLabel ?? null,
        formaPagamento: dados.formaPagamento,
        valorAplicado: dados.valorAplicado,
        valorRecebido: dados.valorRecebido,
        troco: dados.troco,
        registradoEm: dados.registradoEm ?? new Date(),
      },
    });

    return criado as PagamentoParcelaRegistro;
  }

  async removerPagamento(
    comandaId: number,
    parcelaId: number,
  ): Promise<PagamentoParcelaRegistro | null> {
    const existente = await this.prisma.pagamentoParcela.findFirst({
      where: {
        id: parcelaId,
        comandaId,
      },
    });

    if (!existente) {
      return null;
    }

    await this.prisma.pagamentoParcela.delete({
      where: { id: existente.id },
    });

    return existente as PagamentoParcelaRegistro;
  }

  async salvarRecibo(dados: SalvarReciboDados): Promise<ReciboVendaRegistro> {
    const criado = await this.prisma.reciboVenda.create({
      data: {
        codigoAutenticacao: dados.codigoAutenticacao,
        comandaId: dados.comandaId,
        cobrancaId: dados.cobrancaId,
        resumoRecibo: dados.resumoRecibo,
        emitidoEm: dados.emitidoEm ?? new Date(),
      },
    });

    return criado as ReciboVendaRegistro;
  }

  async buscarReciboPorComandaId(comandaId: number): Promise<ReciboVendaRegistro | null> {
    const recibo = await this.prisma.reciboVenda.findUnique({
      where: { comandaId },
    });

    return (recibo as ReciboVendaRegistro) || null;
  }

  async obterResumoTurno(): Promise<ResumoTurnoDto> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const aguardandoPagamento = await this.prisma.cobrancaComanda.count({
      where: { status: 'aguardando_pagamento' },
    });

    const pagasHoje = await this.prisma.cobrancaComanda.count({
      where: {
        status: 'paga',
        pagaEm: { gte: hoje },
      },
    });

    const agregacao = await this.prisma.cobrancaComanda.aggregate({
      where: {
        status: 'paga',
        pagaEm: { gte: hoje },
      },
      _sum: {
        valorPago: true,
      },
    });

    const faturamentoTurno = agregacao._sum.valorPago
      ? agregacao._sum.valorPago.toFixed(2)
      : '0.00';

    return {
      aguardando_pagamento: aguardandoPagamento,
      pagas_hoje: pagasHoje,
      faturamento_turno: faturamentoTurno,
    };
  }

  /**
   * Persiste atomicamente a parcela final, a quitação da cobrança, o recibo e o evento no Outbox.
   */
  async quitarComOutbox(dados: QuitarComOutboxDados): Promise<QuitarComOutboxResultado> {
    return this.prisma.$transaction(async (tx) => {
      const parcela = await tx.pagamentoParcela.create({
        data: {
          cobrancaId: dados.pagamento.cobrancaId,
          comandaId: dados.pagamento.comandaId,
          numeroParcela: dados.pagamento.numeroParcela,
          pagadorLabel: dados.pagamento.pagadorLabel ?? null,
          formaPagamento: dados.pagamento.formaPagamento,
          valorAplicado: dados.pagamento.valorAplicado,
          valorRecebido: dados.pagamento.valorRecebido,
          troco: dados.pagamento.troco,
          registradoEm: dados.pagamento.registradoEm ?? new Date(),
        },
      });

      const cobranca = await tx.cobrancaComanda.update({
        where: { comandaId: dados.comandaId },
        data: {
          mesa: dados.atualizacao.mesa,
          garcomId: dados.atualizacao.garcomId,
          nomeCliente: dados.atualizacao.nomeCliente,
          status: dados.atualizacao.status ?? 'paga',
          aplicarTaxaServico: dados.atualizacao.aplicarTaxaServico,
          subtotal: dados.atualizacao.subtotal,
          taxaServico: dados.atualizacao.taxaServico,
          total: dados.atualizacao.total,
          valorPago: dados.atualizacao.valorPago,
          saldoRestante: dados.atualizacao.saldoRestante,
          trocoTotal: dados.atualizacao.trocoTotal,
          modoDivisao: dados.atualizacao.modoDivisao,
          quantidadePagadores: dados.atualizacao.quantidadePagadores,
          itensSnapshot: dados.atualizacao.itensSnapshot,
          divisaoDetalhes:
            dados.atualizacao.divisaoDetalhes === null
              ? Prisma.JsonNull
              : dados.atualizacao.divisaoDetalhes,
          fechadaEm: dados.atualizacao.fechadaEm,
          pagaEm: dados.atualizacao.pagaEm,
        },
        include: {
          pagamentos: {
            orderBy: { numeroParcela: 'asc' },
          },
          recibo: true,
        },
      });

      const recibo = await tx.reciboVenda.create({
        data: {
          codigoAutenticacao: dados.recibo.codigoAutenticacao,
          comandaId: dados.recibo.comandaId,
          cobrancaId: dados.recibo.cobrancaId,
          resumoRecibo: dados.recibo.resumoRecibo,
          emitidoEm: dados.recibo.emitidoEm ?? new Date(),
        },
      });

      await gravarEventoOutbox(tx, {
        id: dados.eventoOutbox.id,
        tipoEvento: dados.eventoOutbox.tipoEvento,
        chaveAgregado: dados.eventoOutbox.chaveAgregado,
        payload: dados.eventoOutbox.payload,
      });

      return {
        parcela: parcela as PagamentoParcelaRegistro,
        cobranca: { ...cobranca, recibo } as CobrancaComandaRegistro,
        recibo: recibo as ReciboVendaRegistro,
      };
    });
  }
}
