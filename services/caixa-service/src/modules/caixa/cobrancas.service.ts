import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ErroDominio } from '../../shared/erros';
import {
  CobrancasRepository,
  CobrancaFiltros,
  CobrancaComandaRegistro,
  ItemSnapshot,
} from './cobrancas.repository';
import {
  FecharComandaBody,
  DividirComandaBody,
  PagarComandaBody,
  ItemSnapshotInput,
} from './schemas';
import {
  calcularDivisaoPorPessoas,
  calcularDivisaoPorItens,
  ItemComandaParaDivisao,
  ConfigCotaItens,
} from './split-payment.calculator';
import {
  EstoqueCoreGateway,
  GestaoGateway,
  HttpEstoqueCoreGateway,
  HttpGestaoGateway,
} from './gateways';
import {
  gerarCodigoAutenticacao,
  gerarTextoReciboPaper,
  DadosReciboPaper,
} from './recibo.generator';

export class CobrancasService {
  private readonly estoqueGateway: EstoqueCoreGateway;
  private readonly gestaoGateway: GestaoGateway;

  constructor(
    private readonly repository: CobrancasRepository,
    estoqueGateway?: EstoqueCoreGateway,
    gestaoGateway?: GestaoGateway,
  ) {
    this.estoqueGateway =
      estoqueGateway ||
      new HttpEstoqueCoreGateway(process.env.CORE_API_URL || 'http://localhost:3000');
    this.gestaoGateway =
      gestaoGateway ||
      new HttpGestaoGateway(process.env.GESTAO_API_URL || 'http://localhost:3003');
  }

  private normalizarItens(itensInput: ItemSnapshotInput[]): ItemSnapshot[] {
    return itensInput.map((it, idx) => {
      const itemComandaId = it.item_comanda_id || it.id || idx + 1;
      const produtoId = it.produto_id || 1;
      const nome = it.nome || it.nome_copiado || `Item ${itemComandaId}`;
      const precoUnitarioDecimal = new Prisma.Decimal(
        it.preco_unitario || it.preco_copiado || '0.00',
      );
      const quantidade = it.quantidade;
      const subtotalDecimal = precoUnitarioDecimal.mul(quantidade);

      return {
        item_comanda_id: itemComandaId,
        produto_id: produtoId,
        nome,
        preco_unitario: precoUnitarioDecimal.toFixed(2),
        quantidade,
        subtotal: subtotalDecimal.toFixed(2),
      };
    });
  }

  private calcularSubtotal(itens: ItemSnapshot[]): Prisma.Decimal {
    return itens.reduce(
      (acc, it) => acc.add(new Prisma.Decimal(it.subtotal)),
      new Prisma.Decimal('0.00'),
    );
  }

  private formatarCobranca(cobranca: CobrancaComandaRegistro) {
    const itensSnapshot: ItemSnapshot[] = Array.isArray(cobranca.itensSnapshot)
      ? cobranca.itensSnapshot
      : [];

    const parcelas = (cobranca.pagamentos || []).map((p) => ({
      id: p.id,
      numero_parcela: p.numeroParcela,
      pagador_rotulo: p.pagadorLabel,
      forma_pagamento: p.formaPagamento,
      valor_aplicado: p.valorAplicado.toFixed(2),
      valor_recebido: p.valorRecebido.toFixed(2),
      troco: p.troco.toFixed(2),
      criado_em: p.registradoEm.toISOString(),
    }));

    let statusCalculado = cobranca.status;
    if (
      cobranca.status === 'aguardando_pagamento' &&
      cobranca.valorPago.gt(0) &&
      cobranca.saldoRestante.gt(0)
    ) {
      statusCalculado = 'parcialmente_paga';
    }

    const divisaoDetalhes = cobranca.divisaoDetalhes as Record<string, unknown> | null;
    const cotas = divisaoDetalhes && Array.isArray((divisaoDetalhes as any).cotas)
      ? (divisaoDetalhes as any).cotas
      : undefined;

    return {
      id: cobranca.id,
      comanda_id: cobranca.comandaId,
      mesa: cobranca.mesa,
      garcom_id: cobranca.garcomId,
      garcom_nome: (cobranca.divisaoDetalhes as any)?.garcom_nome || `Garçom #${cobranca.garcomId}`,
      nome_cliente: cobranca.nomeCliente,
      status: statusCalculado,
      aplicar_taxa_servico: cobranca.aplicarTaxaServico,
      subtotal: cobranca.subtotal.toFixed(2),
      taxa_servico: cobranca.taxaServico.toFixed(2),
      total: cobranca.total.toFixed(2),
      valor_pago: cobranca.valorPago.toFixed(2),
      saldo_restante: cobranca.saldoRestante.toFixed(2),
      troco_total: cobranca.trocoTotal.toFixed(2),
      pessoas_divisao: cobranca.quantidadePagadores,
      quantidade_pagadores: cobranca.quantidadePagadores,
      modo_divisao: cobranca.modoDivisao,
      itens: itensSnapshot,
      parcelas,
      divisao_detalhes: cobranca.divisaoDetalhes,
      cotas,
      recibo: cobranca.recibo
        ? {
            id: cobranca.recibo.id,
            numero_recibo: cobranca.recibo.id,
            codigo_autenticacao: cobranca.recibo.codigoAutenticacao,
            emitido_em: cobranca.recibo.emitidoEm.toISOString(),
          }
        : null,
      fechada_em: cobranca.fechadaEm.toISOString(),
      paga_em: cobranca.pagaEm ? cobranca.pagaEm.toISOString() : null,
    };
  }

  async listar(filtros?: CobrancaFiltros) {
    const comandas = await this.repository.listar(filtros);
    const resumoTurno = await this.repository.obterResumoTurno();

    const comandasFormatadas = comandas.map((c) => this.formatarCobranca(c));

    return {
      comandas: comandasFormatadas,
      resumo_turno: resumoTurno,
      aguardando_pagamento: resumoTurno.aguardando_pagamento,
      pagas_hoje: resumoTurno.pagas_hoje,
      faturamento_turno: resumoTurno.faturamento_turno,
    };
  }

  async buscarPorComandaId(comandaId: number) {
    if (!Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.parametroInvalido('ID da comanda deve ser um número inteiro positivo.');
    }

    const cobranca = await this.repository.buscarPorComandaId(comandaId);
    if (!cobranca) {
      throw ErroDominio.naoEncontrado(
        `Cobrança não encontrada para a comanda ${comandaId}.`,
        { comanda_id: comandaId },
      );
    }

    return this.formatarCobranca(cobranca);
  }

  async fecharOuRecalcular(comandaId: number, dados: FecharComandaBody) {
    if (!Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.parametroInvalido('ID da comanda deve ser um número inteiro positivo.');
    }

    const cobrancaExistente = await this.repository.buscarPorComandaId(comandaId);

    if (cobrancaExistente) {
      // Regra: Comanda quitada ou cancelada é imutável
      if (cobrancaExistente.status === 'paga' || cobrancaExistente.status === 'cancelada') {
        throw ErroDominio.comandaImutavel(
          'Comanda já finalizada ou cancelada não pode ser alterada.',
          { comanda_id: comandaId, status: cobrancaExistente.status },
        );
      }

      // Toggle ou manutenção da taxa de serviço
      const aplicarTaxa =
        dados.aplicar_taxa_servico !== undefined
          ? dados.aplicar_taxa_servico
          : cobrancaExistente.aplicarTaxaServico;

      let subtotal = cobrancaExistente.subtotal;
      let itensSnapshot = cobrancaExistente.itensSnapshot;

      if (dados.itens && Array.isArray(dados.itens) && dados.itens.length > 0) {
        itensSnapshot = this.normalizarItens(dados.itens);
        subtotal = this.calcularSubtotal(itensSnapshot);
      }

      let taxaServico = new Prisma.Decimal('0.00');
      if (aplicarTaxa) {
        taxaServico = subtotal
          .mul(new Prisma.Decimal('0.10'))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      }

      const total = subtotal.add(taxaServico);
      let saldoRestante = total.sub(cobrancaExistente.valorPago);
      if (saldoRestante.lt(0)) {
        saldoRestante = new Prisma.Decimal('0.00');
      }

      const atualizada = await this.repository.atualizar(comandaId, {
        mesa: dados.mesa ?? cobrancaExistente.mesa,
        garcomId: dados.garcom_id ?? cobrancaExistente.garcomId,
        nomeCliente: dados.nome_cliente !== undefined ? dados.nome_cliente : cobrancaExistente.nomeCliente,
        aplicarTaxaServico: aplicarTaxa,
        subtotal,
        taxaServico,
        total,
        saldoRestante,
        itensSnapshot,
      });

      return this.formatarCobranca(atualizada);
    }

    // Criação inicial da cobrança sincronizada a partir do fechamento no salão
    if (!dados.mesa || dados.mesa < 1) {
      throw ErroDominio.validacao('O número da mesa é obrigatório e deve ser maior ou igual a 1.', {
        mesa: 'Número da mesa inválido.',
      });
    }

    if (!dados.garcom_id || dados.garcom_id < 1) {
      throw ErroDominio.validacao('O identificador do garçom é obrigatório e deve ser maior ou igual a 1.', {
        garcom_id: 'Identificador do garçom inválido.',
      });
    }

    if (!dados.itens || !Array.isArray(dados.itens) || dados.itens.length === 0) {
      throw ErroDominio.validacao('A comanda deve possuir pelo menos um item para fechamento.', {
        itens: 'Lista de itens não pode ser vazia.',
      });
    }

    const itensSnapshot = this.normalizarItens(dados.itens);
    const subtotal = this.calcularSubtotal(itensSnapshot);

    const aplicarTaxa = dados.aplicar_taxa_servico ?? true;
    let taxaServico = new Prisma.Decimal('0.00');
    if (aplicarTaxa) {
      taxaServico = subtotal
        .mul(new Prisma.Decimal('0.10'))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }

    const total = subtotal.add(taxaServico);

    const novaCobranca = await this.repository.criar({
      comandaId,
      mesa: dados.mesa,
      garcomId: dados.garcom_id,
      nomeCliente: dados.nome_cliente ?? null,
      status: 'aguardando_pagamento',
      aplicarTaxaServico: aplicarTaxa,
      subtotal,
      taxaServico,
      total,
      valorPago: new Prisma.Decimal('0.00'),
      saldoRestante: total,
      trocoTotal: new Prisma.Decimal('0.00'),
      modoDivisao: 'integral',
      quantidadePagadores: 1,
      itensSnapshot,
      divisaoDetalhes: dados.garcom_nome ? { garcom_nome: dados.garcom_nome } : null,
      fechadaEm: new Date(),
    });

    return this.formatarCobranca(novaCobranca);
  }

  async dividirConta(comandaId: number, dados: DividirComandaBody) {
    if (!Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.parametroInvalido('ID da comanda deve ser um número inteiro positivo.');
    }

    const cobranca = await this.repository.buscarPorComandaId(comandaId);
    if (!cobranca) {
      throw ErroDominio.naoEncontrado(
        `Cobrança não encontrada para a comanda ${comandaId}.`,
        { comanda_id: comandaId },
      );
    }

    if (cobranca.status === 'paga' || cobranca.status === 'cancelada') {
      throw ErroDominio.comandaImutavel(
        'Comanda já quitada ou cancelada não pode ser dividida.',
        { comanda_id: comandaId, status: cobranca.status },
      );
    }

    const saldoADividir = cobranca.saldoRestante.gt(0)
      ? cobranca.saldoRestante
      : cobranca.total;

    if (dados.modo === 'pessoas') {
      const pessoas = dados.pessoas ?? dados.quantidade_pessoas;
      if (!pessoas || !Number.isInteger(pessoas) || pessoas < 2) {
        throw ErroDominio.divisaoInvalida(
          'A divisão por pessoas requer pelo menos 2 pessoas.',
          { pessoas: 'Informe um número inteiro maior ou igual a 2.' },
        );
      }

      const cotasCalculadas = calcularDivisaoPorPessoas(saldoADividir, pessoas);

      const divisaoDetalhes = {
        modo: 'pessoas',
        pessoas,
        total_comanda: cobranca.total.toFixed(2),
        saldo_a_dividir: saldoADividir.toFixed(2),
        cotas: cotasCalculadas,
      };

      await this.repository.atualizar(comandaId, {
        modoDivisao: 'pessoas',
        quantidadePagadores: pessoas,
        divisaoDetalhes,
      });

      return {
        comanda_id: cobranca.comandaId,
        mesa: cobranca.mesa,
        modo: 'pessoas',
        pessoas,
        total_comanda: cobranca.total.toFixed(2),
        saldo_a_dividir: saldoADividir.toFixed(2),
        cotas: cotasCalculadas,
      };
    }

    if (dados.modo === 'itens') {
      const cotasConfig = dados.cotas ?? dados.itens_selecionados;
      if (!Array.isArray(cotasConfig) || cotasConfig.length < 2) {
        throw ErroDominio.divisaoInvalida(
          'A divisão por itens requer pelo menos 2 cotas com itens definidos.',
          { cotas: 'Informe pelo menos duas cotas.' },
        );
      }

      const itensSnapshot: ItemSnapshot[] = Array.isArray(cobranca.itensSnapshot)
        ? cobranca.itensSnapshot
        : [];

      const itensParaDivisao: ItemComandaParaDivisao[] = itensSnapshot.map((it) => ({
        item_comanda_id: it.item_comanda_id,
        produto_id: it.produto_id,
        nome: it.nome,
        preco_unitario: it.preco_unitario,
        quantidade: it.quantidade,
      }));

      const cotasCalculadas = calcularDivisaoPorItens(
        itensParaDivisao,
        cotasConfig as ConfigCotaItens[],
        cobranca.aplicarTaxaServico,
        cobranca.total,
      );

      const divisaoDetalhes = {
        modo: 'itens',
        pessoas: cotasCalculadas.length,
        total_comanda: cobranca.total.toFixed(2),
        saldo_a_dividir: saldoADividir.toFixed(2),
        cotas: cotasCalculadas,
      };

      await this.repository.atualizar(comandaId, {
        modoDivisao: 'itens',
        quantidadePagadores: cotasCalculadas.length,
        divisaoDetalhes,
      });

      return {
        comanda_id: cobranca.comandaId,
        mesa: cobranca.mesa,
        modo: 'itens',
        pessoas: cotasCalculadas.length,
        total_comanda: cobranca.total.toFixed(2),
        saldo_a_dividir: saldoADividir.toFixed(2),
        cotas: cotasCalculadas,
      };
    }

    throw ErroDominio.divisaoInvalida(
      'Modo de divisão inválido. Use "pessoas" ou "itens".',
      { modo: dados.modo },
    );
  }

  async pagarComanda(comandaId: number, dados: PagarComandaBody) {
    if (!Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.parametroInvalido('ID da comanda deve ser um número inteiro positivo.');
    }

    const cobranca = await this.repository.buscarPorComandaId(comandaId);
    if (!cobranca) {
      throw ErroDominio.naoEncontrado(
        `Cobrança não encontrada para a comanda ${comandaId}.`,
        { comanda_id: comandaId },
      );
    }

    if (cobranca.status === 'paga' || cobranca.saldoRestante.isZero()) {
      throw ErroDominio.comandaImutavel(
        'Comanda já quitada não aceita novos pagamentos.',
        { comanda_id: comandaId, status: cobranca.status },
      );
    }

    if (cobranca.status === 'cancelada') {
      throw ErroDominio.comandaImutavel(
        'Comanda cancelada não pode receber pagamentos.',
        { comanda_id: comandaId, status: cobranca.status },
      );
    }

    const formaPagamento = dados.forma_pagamento;
    if (!['dinheiro', 'pix', 'cartao'].includes(formaPagamento)) {
      throw ErroDominio.validacao(
        'Forma de pagamento inválida. Aceitos: dinheiro, pix, cartao.',
        { forma_pagamento: formaPagamento },
      );
    }

    // Determina valor a aplicar (se omitido, assume o saldo_restante da comanda)
    const valorRaw = dados.valor_aplicado ?? dados.valor;
    let valorAplicado: Prisma.Decimal;
    if (valorRaw !== undefined && valorRaw !== null && valorRaw !== '') {
      valorAplicado = new Prisma.Decimal(valorRaw).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
    } else {
      valorAplicado = cobranca.saldoRestante;
    }

    if (valorAplicado.lte(0)) {
      throw ErroDominio.valorPagamentoInvalido(
        'O valor a ser aplicado no pagamento deve ser maior que zero.',
        { valor_aplicado: valorAplicado.toFixed(2) },
      );
    }

    if (valorAplicado.gt(cobranca.saldoRestante)) {
      throw ErroDominio.valorPagamentoInvalido(
        'O valor do pagamento não pode ser maior que o saldo restante da comanda.',
        {
          valor_aplicado: valorAplicado.toFixed(2),
          saldo_restante: cobranca.saldoRestante.toFixed(2),
        },
      );
    }

    let valorRecebido: Prisma.Decimal;
    let troco = new Prisma.Decimal('0.00');

    if (formaPagamento === 'dinheiro') {
      if (
        dados.valor_recebido !== undefined &&
        dados.valor_recebido !== null &&
        dados.valor_recebido !== ''
      ) {
        valorRecebido = new Prisma.Decimal(dados.valor_recebido).toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        );
      } else {
        valorRecebido = valorAplicado;
      }

      if (valorRecebido.lt(valorAplicado)) {
        throw ErroDominio.validacao(
          'Valor recebido não pode ser menor que o valor aplicado.',
          {
            valor_aplicado: valorAplicado.toFixed(2),
            valor_recebido: valorRecebido.toFixed(2),
          },
        );
      }

      troco = valorRecebido.sub(valorAplicado).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
    } else {
      valorRecebido = valorAplicado;
      troco = new Prisma.Decimal('0.00');
    }

    const pagamentosAtuais = cobranca.pagamentos || [];
    const numeroParcela = dados.numero_parcela ?? pagamentosAtuais.length + 1;
    const pagadorLabel =
      dados.pagador_rotulo ??
      dados.pagador_label ??
      (cobranca.quantidadePagadores > 1
        ? `Pessoa ${numeroParcela} de ${cobranca.quantidadePagadores}`
        : 'Conta Integral');

    const novoValorPago = cobranca.valorPago.add(valorAplicado);
    let novoSaldoRestante = cobranca.saldoRestante.sub(valorAplicado);
    if (novoSaldoRestante.lt(0)) {
      novoSaldoRestante = new Prisma.Decimal('0.00');
    }
    const novoTrocoTotal = cobranca.trocoTotal.add(troco);
    const quitada = novoSaldoRestante.isZero();
    const agora = new Date();

    const itensSnapshot: ItemSnapshot[] = Array.isArray(cobranca.itensSnapshot)
      ? cobranca.itensSnapshot
      : [];

    // RESILIÊNCIA E FAIL-FAST (ADR-07):
    // Ao zerar o saldo_restante, aciona baixa atômica de estoque no Core ANTES de comitar
    if (quitada) {
      const itensParaBaixa = itensSnapshot.map((it) => ({
        produto_id: it.produto_id,
        quantidade: it.quantidade,
      }));

      await this.estoqueGateway.baixarEstoque(cobranca.comandaId, itensParaBaixa);
    }

    // Registra a parcela de pagamento
    const parcelaCriada = await this.repository.registrarPagamento({
      cobrancaId: cobranca.id,
      comandaId: cobranca.comandaId,
      numeroParcela,
      pagadorLabel,
      formaPagamento,
      valorAplicado,
      valorRecebido,
      troco,
      registradoEm: agora,
    });

    // Atualiza a cobrança no banco
    const cobrancaAtualizada = await this.repository.atualizar(comandaId, {
      valorPago: novoValorPago,
      saldoRestante: novoSaldoRestante,
      trocoTotal: novoTrocoTotal,
      status: quitada ? 'paga' : 'aguardando_pagamento',
      pagaEm: quitada ? agora : null,
    });

    let reciboResposta: any = null;

    if (quitada) {
      // Gera código de autenticação único VAPT-YYYYMMDD-MESA-XXXX
      const codigoAutenticacao = gerarCodigoAutenticacao(cobranca.mesa, agora);

      const todosPagamentos = [...pagamentosAtuais, parcelaCriada];
      const pagamentosFormatados = todosPagamentos.map((p) => ({
        numero_parcela: p.numeroParcela,
        pagador_rotulo: p.pagadorLabel,
        forma_pagamento: p.formaPagamento,
        valor_aplicado: p.valorAplicado.toFixed(2),
        valor_recebido: p.valorRecebido.toFixed(2),
        troco: p.troco.toFixed(2),
      }));

      const itensFormatados = itensSnapshot.map((it) => ({
        nome: it.nome,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        subtotal: it.subtotal,
      }));

      const garcomNome =
        (cobranca.divisaoDetalhes as any)?.garcom_nome || `Garçom #${cobranca.garcomId}`;

      const resumoRecibo = {
        comanda_id: cobranca.comandaId,
        mesa: cobranca.mesa,
        garcom_nome: garcomNome,
        operador_caixa: dados.operador_nome || 'Operador de Caixa',
        codigo_autenticacao: codigoAutenticacao,
        subtotal: cobranca.subtotal.toFixed(2),
        taxa_servico: cobranca.taxaServico.toFixed(2),
        total: cobranca.total.toFixed(2),
        troco_total: novoTrocoTotal.toFixed(2),
        itens: itensFormatados,
        pagamentos: pagamentosFormatados,
        emitido_em: agora.toISOString(),
      };

      const reciboSalvo = await this.repository.salvarRecibo({
        codigoAutenticacao,
        comandaId: cobranca.comandaId,
        cobrancaId: cobranca.id,
        resumoRecibo,
        emitidoEm: agora,
      });

      reciboResposta = {
        id: reciboSalvo.id,
        numero_recibo: reciboSalvo.id,
        codigo_autenticacao: reciboSalvo.codigoAutenticacao,
        emitido_em: reciboSalvo.emitidoEm.toISOString(),
      };

      // Dispara evento para gestao-service com resiliência e degradação graciosa (ASR-04, ADR-07, SM-C2)
      const eventoComandaPaga = {
        evento_id: crypto.randomUUID(),
        evento: 'comanda.paga',
        versao: 1,
        ocorrido_em: agora.toISOString(),
        data_hora: agora.toISOString(),
        timestamp: agora.toISOString(),
        comanda_id: cobranca.comandaId,
        mesa: cobranca.mesa,
        garcom_id: cobranca.garcomId,
        garcom_nome: garcomNome,
        forma_pagamento: formaPagamento,
        aplicar_taxa_servico: cobranca.aplicarTaxaServico,
        subtotal: cobranca.subtotal.toFixed(2),
        valor_subtotal: cobranca.subtotal.toFixed(2),
        taxa_servico: cobranca.taxaServico.toFixed(2),
        total: cobranca.total.toFixed(2),
        valor_total: cobranca.total.toFixed(2),
        troco: novoTrocoTotal.toFixed(2),
        troco_total: novoTrocoTotal.toFixed(2),
        paga_em: agora.toISOString(),
        itens: itensSnapshot.map((it) => ({
          item_comanda_id: it.item_comanda_id,
          produto_id: it.produto_id,
          nome: it.nome,
          nome_copiado: it.nome,
          preco_unitario: it.preco_unitario,
          preco_copiado: it.preco_unitario,
          quantidade: it.quantidade,
          subtotal: it.subtotal,
        })),
        parcelas: pagamentosFormatados,
      };

      let avisoGestao: string | undefined;
      try {
        const resGestao = await this.gestaoGateway.notificarComandaPaga(eventoComandaPaga);
        if (resGestao && !resGestao.sucesso) {
          avisoGestao = `integracao_gestao_pendente: ${resGestao.erro || 'Falha ao notificar gestao-service'}`;
        }
      } catch (err: any) {
        avisoGestao = `integracao_gestao_pendente: ${err?.message || 'Falha ao notificar gestao-service'}`;
      }

      if (avisoGestao) {
        // Degradação graciosa: apenas registra aviso, sem reverter a venda
      }
    }

    let statusCalculado = cobrancaAtualizada.status;
    if (!quitada && cobrancaAtualizada.valorPago.gt(0)) {
      statusCalculado = 'parcialmente_paga';
    }

    return {
      comanda_id: cobrancaAtualizada.comandaId,
      mesa: cobrancaAtualizada.mesa,
      status: statusCalculado,
      aplicar_taxa_servico: cobrancaAtualizada.aplicarTaxaServico,
      subtotal: cobrancaAtualizada.subtotal.toFixed(2),
      taxa_servico: cobrancaAtualizada.taxaServico.toFixed(2),
      total: cobrancaAtualizada.total.toFixed(2),
      valor_pago: cobrancaAtualizada.valorPago.toFixed(2),
      saldo_restante: cobrancaAtualizada.saldoRestante.toFixed(2),
      troco_total: cobrancaAtualizada.trocoTotal.toFixed(2),
      parcela_registrada: {
        id: parcelaCriada.id,
        numero_parcela: parcelaCriada.numeroParcela,
        pagador_rotulo: parcelaCriada.pagadorLabel,
        forma_pagamento: parcelaCriada.formaPagamento,
        valor_aplicado: parcelaCriada.valorAplicado.toFixed(2),
        valor_recebido: parcelaCriada.valorRecebido.toFixed(2),
        troco: parcelaCriada.troco.toFixed(2),
        criado_em: parcelaCriada.registradoEm.toISOString(),
      },
      recibo: reciboResposta,
      avisos: [],
    };
  }

  async obterRecibo(comandaId: number) {
    if (!Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.parametroInvalido('ID da comanda deve ser um número inteiro positivo.');
    }

    const cobranca = await this.repository.buscarPorComandaId(comandaId);
    if (!cobranca) {
      throw ErroDominio.naoEncontrado(
        `Cobrança não encontrada para a comanda ${comandaId}.`,
        { comanda_id: comandaId },
      );
    }

    if (cobranca.status !== 'paga' || cobranca.saldoRestante.gt(0)) {
      throw ErroDominio.naoEncontrado(
        'Recibo não disponível. A comanda ainda não foi totalmente liquidada.',
        { comanda_id: comandaId, status: cobranca.status },
      );
    }

    let recibo = cobranca.recibo || (await this.repository.buscarReciboPorComandaId(comandaId));

    const itensSnapshot: ItemSnapshot[] = Array.isArray(cobranca.itensSnapshot)
      ? cobranca.itensSnapshot
      : [];

    const itensFormatados = itensSnapshot.map((it) => ({
      nome: it.nome,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
      subtotal: it.subtotal,
    }));

    const pagamentos = cobranca.pagamentos || [];
    const pagamentosFormatados = pagamentos.map((p) => ({
      numero_parcela: p.numeroParcela,
      pagador_rotulo: p.pagadorLabel,
      forma_pagamento: p.formaPagamento,
      valor_aplicado: p.valorAplicado.toFixed(2),
      valor_recebido: p.valorRecebido.toFixed(2),
      troco: p.troco.toFixed(2),
    }));

    const garcomNome =
      (cobranca.divisaoDetalhes as any)?.garcom_nome || `Garçom #${cobranca.garcomId}`;
    const operadorCaixa =
      (recibo?.resumoRecibo as any)?.operador_caixa || 'Operador de Caixa';

    if (!recibo) {
      const agora = cobranca.pagaEm || new Date();
      const codigoAutenticacao = gerarCodigoAutenticacao(cobranca.mesa, agora);
      const resumoRecibo = {
        comanda_id: cobranca.comandaId,
        mesa: cobranca.mesa,
        garcom_nome: garcomNome,
        operador_caixa: operadorCaixa,
        codigo_autenticacao: codigoAutenticacao,
        subtotal: cobranca.subtotal.toFixed(2),
        taxa_servico: cobranca.taxaServico.toFixed(2),
        total: cobranca.total.toFixed(2),
        troco_total: cobranca.trocoTotal.toFixed(2),
        itens: itensFormatados,
        pagamentos: pagamentosFormatados,
        emitido_em: agora.toISOString(),
      };

      recibo = await this.repository.salvarRecibo({
        codigoAutenticacao,
        comandaId: cobranca.comandaId,
        cobrancaId: cobranca.id,
        resumoRecibo,
        emitidoEm: agora,
      });
    }

    const dadosParaPaper: DadosReciboPaper = {
      comanda_id: cobranca.comandaId,
      mesa: cobranca.mesa,
      garcom_nome: garcomNome,
      operador_caixa: operadorCaixa,
      codigo_autenticacao: recibo.codigoAutenticacao,
      emitido_em: recibo.emitidoEm.toISOString(),
      subtotal: cobranca.subtotal.toFixed(2),
      taxa_servico: cobranca.taxaServico.toFixed(2),
      total: cobranca.total.toFixed(2),
      troco_total: cobranca.trocoTotal.toFixed(2),
      itens: itensFormatados,
      pagamentos: pagamentosFormatados,
    };

    const paperText = gerarTextoReciboPaper(dadosParaPaper);

    return {
      id: recibo.id,
      numero_recibo: recibo.id,
      comanda_id: cobranca.comandaId,
      mesa: cobranca.mesa,
      garcom_nome: garcomNome,
      operador_caixa: operadorCaixa,
      codigo_autenticacao: recibo.codigoAutenticacao,
      subtotal: cobranca.subtotal.toFixed(2),
      taxa_servico: cobranca.taxaServico.toFixed(2),
      total: cobranca.total.toFixed(2),
      troco_total: cobranca.trocoTotal.toFixed(2),
      itens: itensFormatados,
      pagamentos: pagamentosFormatados,
      emitido_em: recibo.emitidoEm.toISOString(),
      paper_text: paperText,
    };
  }
}
