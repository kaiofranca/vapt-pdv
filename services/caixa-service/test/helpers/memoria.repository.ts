import { Prisma } from '@prisma/client';
import {
  CobrancasRepository,
  CobrancaFiltros,
  CobrancaComandaRegistro,
  CriarCobrancaDados,
  AtualizarCobrancaDados,
  RegistrarPagamentoDados,
  SalvarReciboDados,
  PagamentoParcelaRegistro,
  ReciboVendaRegistro,
  ResumoTurnoDto,
} from '../../src/modules/caixa/cobrancas.repository';

export class MemoriaCobrancasRepository implements CobrancasRepository {
  private cobrancasPorComandaId = new Map<number, CobrancaComandaRegistro>();
  private recibosPorComandaId = new Map<number, ReciboVendaRegistro>();
  private proximoId = 1;
  private proximoPagamentoId = 1;
  private proximoReciboId = 1;

  limpar(): void {
    this.cobrancasPorComandaId.clear();
    this.recibosPorComandaId.clear();
    this.proximoId = 1;
    this.proximoPagamentoId = 1;
    this.proximoReciboId = 1;
  }

  async listar(filtros?: CobrancaFiltros): Promise<CobrancaComandaRegistro[]> {
    let lista = Array.from(this.cobrancasPorComandaId.values());

    if (filtros?.status) {
      const st = filtros.status.toLowerCase().trim();
      if (st === 'fechada' || st === 'aguardando_pagamento') {
        lista = lista.filter((c) => c.status === 'aguardando_pagamento');
      } else if (st === 'paga') {
        lista = lista.filter((c) => c.status === 'paga');
      } else if (st === 'cancelada') {
        lista = lista.filter((c) => c.status === 'cancelada');
      } else if (st === 'parcialmente_paga') {
        lista = lista.filter(
          (c) => c.status === 'aguardando_pagamento' && c.valorPago.gt(0),
        );
      }
    }

    if (filtros?.mesa) {
      lista = lista.filter((c) => c.mesa === filtros.mesa);
    }

    if (filtros?.busca) {
      const termo = filtros.busca.toLowerCase().trim();
      const mesaNum = parseInt(termo, 10);

      lista = lista.filter((c) => {
        if (!isNaN(mesaNum) && c.mesa === mesaNum) {
          return true;
        }
        if (c.nomeCliente && c.nomeCliente.toLowerCase().includes(termo)) {
          return true;
        }
        const garcomNome = (c.divisaoDetalhes as any)?.garcom_nome;
        if (garcomNome && String(garcomNome).toLowerCase().includes(termo)) {
          return true;
        }
        return false;
      });
    }

    if (filtros?.periodo === 'hoje') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      lista = lista.filter((c) => c.fechadaEm >= hoje);
    }

    return lista.sort((a, b) => b.fechadaEm.getTime() - a.fechadaEm.getTime());
  }

  async buscarPorComandaId(comandaId: number): Promise<CobrancaComandaRegistro | null> {
    const item = this.cobrancasPorComandaId.get(comandaId);
    if (!item) return null;
    const recibo = this.recibosPorComandaId.get(comandaId) || null;
    return { ...item, recibo };
  }

  async buscarPorId(id: number): Promise<CobrancaComandaRegistro | null> {
    for (const c of this.cobrancasPorComandaId.values()) {
      if (c.id === id) {
        const recibo = this.recibosPorComandaId.get(c.comandaId) || null;
        return { ...c, recibo };
      }
    }
    return null;
  }

  async criar(dados: CriarCobrancaDados): Promise<CobrancaComandaRegistro> {
    const registro: CobrancaComandaRegistro = {
      id: this.proximoId++,
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
      divisaoDetalhes: dados.divisaoDetalhes ?? null,
      fechadaEm: dados.fechadaEm ?? new Date(),
      pagaEm: dados.pagaEm ?? null,
      pagamentos: [],
    };

    this.cobrancasPorComandaId.set(dados.comandaId, registro);
    return { ...registro };
  }

  async atualizar(
    comandaId: number,
    dados: AtualizarCobrancaDados,
  ): Promise<CobrancaComandaRegistro> {
    const existente = this.cobrancasPorComandaId.get(comandaId);
    if (!existente) {
      throw new Error(`Cobrança com comandaId ${comandaId} não encontrada no repositório em memória.`);
    }

    const atualizado: CobrancaComandaRegistro = {
      ...existente,
      mesa: dados.mesa !== undefined ? dados.mesa : existente.mesa,
      garcomId: dados.garcomId !== undefined ? dados.garcomId : existente.garcomId,
      nomeCliente: dados.nomeCliente !== undefined ? dados.nomeCliente : existente.nomeCliente,
      status: dados.status !== undefined ? dados.status : existente.status,
      aplicarTaxaServico:
        dados.aplicarTaxaServico !== undefined
          ? dados.aplicarTaxaServico
          : existente.aplicarTaxaServico,
      subtotal: dados.subtotal !== undefined ? dados.subtotal : existente.subtotal,
      taxaServico: dados.taxaServico !== undefined ? dados.taxaServico : existente.taxaServico,
      total: dados.total !== undefined ? dados.total : existente.total,
      valorPago: dados.valorPago !== undefined ? dados.valorPago : existente.valorPago,
      saldoRestante:
        dados.saldoRestante !== undefined ? dados.saldoRestante : existente.saldoRestante,
      trocoTotal: dados.trocoTotal !== undefined ? dados.trocoTotal : existente.trocoTotal,
      modoDivisao: dados.modoDivisao !== undefined ? dados.modoDivisao : existente.modoDivisao,
      quantidadePagadores:
        dados.quantidadePagadores !== undefined
          ? dados.quantidadePagadores
          : existente.quantidadePagadores,
      itensSnapshot:
        dados.itensSnapshot !== undefined ? dados.itensSnapshot : existente.itensSnapshot,
      divisaoDetalhes:
        dados.divisaoDetalhes !== undefined ? dados.divisaoDetalhes : existente.divisaoDetalhes,
      fechadaEm: dados.fechadaEm !== undefined ? dados.fechadaEm : existente.fechadaEm,
      pagaEm: dados.pagaEm !== undefined ? dados.pagaEm : existente.pagaEm,
    };

    this.cobrancasPorComandaId.set(comandaId, atualizado);
    return { ...atualizado };
  }

  async obterResumoTurno(): Promise<ResumoTurnoDto> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let aguardando = 0;
    let pagasHoje = 0;
    let faturamento = new Prisma.Decimal('0.00');

    for (const c of this.cobrancasPorComandaId.values()) {
      if (c.status === 'aguardando_pagamento') {
        aguardando++;
      } else if (c.status === 'paga') {
        if (!c.pagaEm || c.pagaEm >= hoje) {
          pagasHoje++;
          faturamento = faturamento.add(c.valorPago);
        }
      }
    }

    return {
      aguardando_pagamento: aguardando,
      pagas_hoje: pagasHoje,
      faturamento_turno: faturamento.toFixed(2),
    };
  }

  async registrarPagamento(
    dados: RegistrarPagamentoDados,
  ): Promise<PagamentoParcelaRegistro> {
    const registro: PagamentoParcelaRegistro = {
      id: this.proximoPagamentoId++,
      cobrancaId: dados.cobrancaId,
      comandaId: dados.comandaId,
      numeroParcela: dados.numeroParcela,
      pagadorLabel: dados.pagadorLabel ?? null,
      formaPagamento: dados.formaPagamento,
      valorAplicado: dados.valorAplicado,
      valorRecebido: dados.valorRecebido,
      troco: dados.troco,
      registradoEm: dados.registradoEm ?? new Date(),
    };

    const cobranca = this.cobrancasPorComandaId.get(dados.comandaId);
    if (cobranca) {
      cobranca.pagamentos = cobranca.pagamentos || [];
      cobranca.pagamentos.push(registro);
    }

    return { ...registro };
  }

  async salvarRecibo(dados: SalvarReciboDados): Promise<ReciboVendaRegistro> {
    const registro: ReciboVendaRegistro = {
      id: this.proximoReciboId++,
      codigoAutenticacao: dados.codigoAutenticacao,
      comandaId: dados.comandaId,
      cobrancaId: dados.cobrancaId,
      resumoRecibo: dados.resumoRecibo,
      emitidoEm: dados.emitidoEm ?? new Date(),
    };

    this.recibosPorComandaId.set(dados.comandaId, registro);

    const cobranca = this.cobrancasPorComandaId.get(dados.comandaId);
    if (cobranca) {
      cobranca.recibo = registro;
    }

    return { ...registro };
  }

  async buscarReciboPorComandaId(comandaId: number): Promise<ReciboVendaRegistro | null> {
    const recibo = this.recibosPorComandaId.get(comandaId);
    return recibo ? { ...recibo } : null;
  }
}
