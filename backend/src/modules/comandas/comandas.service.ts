import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ErroDominio } from '../../shared/erros';
import type { ServicoUsuarios } from '../usuarios/servico';
import type { ServicoProdutos } from '../produtos/servico';
import {
  AjustarItemDados,
  ComandaEntidade,
  CriarComandaDados,
  ehErroUnicidadePrisma,
  FecharComandaDados,
  FiltrosListagemComandas,
  FormaPagamentoTipo,
  formatarValorMonetario,
  formatarValorMonetarioOpcional,
  ItemComandaEntidade,
  LancarItemDados,
  normalizarMesa,
  normalizarNomeCliente,
  PagarComandaDados,
  parsearDataIso8601,
  RegistroComandaBanco,
  RegistroItemComandaBanco,
  StatusComandaTipo,
} from './comanda.entity';
import { IComandasRepository } from './comandas.repository';
import { CaixaGateway, ICaixaGateway } from '../../shared/gateways/caixa.gateway';
import { GestaoGateway, IGestaoGateway } from '../../shared/gateways/gestao.gateway';

export interface ServicoComandas {
  abrir(dados: CriarComandaDados): Promise<ComandaEntidade>;
  criar(dados: CriarComandaDados): Promise<ComandaEntidade>;
  listar(filtros?: FiltrosListagemComandas): Promise<ComandaEntidade[]>;
  buscarPorId(id: number): Promise<ComandaEntidade>;
  lancarItem(comandaId: number, dados: LancarItemDados): Promise<ItemComandaEntidade>;
  ajustarItem(
    comandaId: number,
    itemId: number,
    dados: AjustarItemDados,
  ): Promise<ItemComandaEntidade>;
  removerItem(comandaId: number, itemId: number): Promise<void>;
  fechar(id: number, dados: FecharComandaDados): Promise<ComandaEntidade>;
  cancelar(id: number): Promise<ComandaEntidade>;
  pagar(id: number, dados: PagarComandaDados): Promise<ComandaEntidade>;
}

export class ComandasService implements ServicoComandas {
  private readonly caixaGateway?: ICaixaGateway;
  private readonly gestaoGateway?: IGestaoGateway;

  constructor(
    private readonly repository: IComandasRepository,
    private readonly servicoUsuarios: ServicoUsuarios,
    private readonly servicoProdutos?: ServicoProdutos,
    caixaGateway?: ICaixaGateway,
    gestaoGateway?: IGestaoGateway,
  ) {
    this.caixaGateway = caixaGateway ?? new CaixaGateway();
    this.gestaoGateway = gestaoGateway ?? new GestaoGateway();
  }

  private formatarItemComanda(registro: RegistroItemComandaBanco): ItemComandaEntidade {
    return {
      id: registro.id,
      produto_id: registro.produto_id,
      nome_copiado: registro.nome_copiado,
      preco_copiado: formatarValorMonetario(registro.preco_copiado),
      quantidade: registro.quantidade,
    };
  }

  private formatarComanda(registro: RegistroComandaBanco): ComandaEntidade {
    const itens = (registro.itens ?? []).map((item) => ({
      id: item.id,
      produto_id: item.produto_id,
      nome_copiado: item.nome_copiado,
      preco_copiado: formatarValorMonetario(item.preco_copiado),
      quantidade: item.quantidade,
    }));

    return {
      id: registro.id,
      mesa: registro.mesa,
      nome_cliente: registro.nome_cliente ?? null,
      garcom_id: registro.garcom_id,
      status: registro.status,
      subtotal: formatarValorMonetarioOpcional(registro.subtotal),
      taxa_servico: formatarValorMonetarioOpcional(registro.taxa_servico),
      total: formatarValorMonetarioOpcional(registro.total),
      forma_pagamento: registro.forma_pagamento ?? null,
      aberta_em: registro.aberta_em,
      fechada_em: registro.fechada_em ?? null,
      paga_em: registro.paga_em ?? null,
      itens,
    };
  }

  async abrir(dados: CriarComandaDados): Promise<ComandaEntidade> {
    const mesaLimpa = normalizarMesa(dados.mesa);
    const nomeCliente = normalizarNomeCliente(dados.nome_cliente);

    if (
      !Number.isFinite(dados.garcom_id) ||
      !Number.isInteger(dados.garcom_id) ||
      dados.garcom_id < 1 ||
      dados.garcom_id > 2147483647
    ) {
      throw ErroDominio.validacao(
        'O identificador do garçom deve ser um número inteiro positivo.',
        {
          garcom_id: 'O identificador do garçom deve ser um inteiro maior ou igual a 1.',
        },
      );
    }

    // Valida o garçom exclusivamente via contrato de serviço de Usuários
    await this.servicoUsuarios.validarGarcom(dados.garcom_id);

    try {
      const comandaCriada = await this.repository.executarEmTransacao(async (tx) => {
        const comandaAbertaNaMesa = await this.repository.buscarAbertaPorMesa(mesaLimpa, tx);

        if (comandaAbertaNaMesa) {
          throw ErroDominio.conflito(
            'MESA_OCUPADA',
            `A mesa "${mesaLimpa}" já possui uma comanda aberta.`,
            {
              mesa: mesaLimpa,
              comanda_id: comandaAbertaNaMesa.id,
            },
          );
        }

        return this.repository.criar(
          {
            mesa: mesaLimpa,
            nome_cliente: nomeCliente,
            garcom_id: dados.garcom_id,
            status: 'aberta',
          },
          tx,
        );
      });

      return this.formatarComanda(comandaCriada);
    } catch (erro) {
      if (ehErroUnicidadePrisma(erro)) {
        throw ErroDominio.conflito(
          'MESA_OCUPADA',
          `A mesa "${mesaLimpa}" já possui uma comanda aberta.`,
          {
            mesa: mesaLimpa,
          },
        );
      }
      throw erro;
    }
  }

  async criar(dados: CriarComandaDados): Promise<ComandaEntidade> {
    return this.abrir(dados);
  }

  async listar(filtros: FiltrosListagemComandas = {}): Promise<ComandaEntidade[]> {
    const limit = filtros.limit ?? 50;
    if (
      !Number.isFinite(limit) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    ) {
      throw ErroDominio.validacao(
        'O parâmetro "limit" deve ser um número inteiro entre 1 e 200.',
        {
          limit: 'O limite deve ser um número inteiro entre 1 e 200.',
        },
      );
    }

    const offset = filtros.offset ?? 0;
    if (
      !Number.isFinite(offset) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 2147483647
    ) {
      throw ErroDominio.validacao(
        'O parâmetro "offset" deve ser um número inteiro maior ou igual a 0.',
        {
          offset: 'O deslocamento deve ser um número inteiro maior ou igual a 0.',
        },
      );
    }

    const dataDe =
      filtros.de !== undefined ? parsearDataIso8601(filtros.de, 'de') : undefined;
    const dataAte =
      filtros.ate !== undefined ? parsearDataIso8601(filtros.ate, 'ate') : undefined;

    if (dataDe && dataAte && dataDe.getTime() > dataAte.getTime()) {
      throw ErroDominio.validacao(
        'O período informado é inválido: a data inicial ("de") não pode ser maior que a data final ("ate").',
        {
          de: 'A data inicial não pode ser posterior à data final.',
          ate: 'A data final deve ser igual ou posterior à data inicial.',
        },
      );
    }

    const where: {
      status?: StatusComandaTipo;
      mesa?: string;
      aberta_em?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (filtros.status !== undefined) {
      where.status = filtros.status;
    }

    if (filtros.mesa !== undefined) {
      const mesaLimpa = filtros.mesa.trim();
      if (!mesaLimpa) {
        throw ErroDominio.validacao('O filtro de mesa não pode ser vazio.', {
          mesa: 'O filtro de mesa não pode ser vazio.',
        });
      }
      if (mesaLimpa.length > 50) {
        throw ErroDominio.validacao(
          'O filtro de mesa não pode exceder 50 caracteres.',
          {
            mesa: 'O filtro de mesa deve ter no máximo 50 caracteres.',
          },
        );
      }
      where.mesa = mesaLimpa;
    }

    if (dataDe || dataAte) {
      where.aberta_em = {};
      if (dataDe) {
        where.aberta_em.gte = dataDe;
      }
      if (dataAte) {
        where.aberta_em.lte = dataAte;
      }
    }

    const registros = await this.repository.listar({
      where,
      take: limit,
      skip: offset,
    });

    return registros.map((registro) => this.formatarComanda(registro));
  }

  async buscarPorId(id: number): Promise<ComandaEntidade> {
    if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw ErroDominio.validacao(
        'O identificador da comanda deve ser um número inteiro positivo.',
        {
          id: 'O identificador da comanda deve ser um inteiro maior ou igual a 1.',
        },
      );
    }

    const registro = await this.repository.buscarPorId(id);

    if (!registro) {
      throw ErroDominio.naoEncontrado(`Comanda com ID ${id} não encontrada.`, {
        id: 'Comanda não encontrada.',
      });
    }

    return this.formatarComanda(registro);
  }

  async lancarItem(
    comandaId: number,
    dados: LancarItemDados,
  ): Promise<ItemComandaEntidade> {
    if (!Number.isFinite(comandaId) || !Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (
      !Number.isFinite(dados.produto_id) ||
      !Number.isInteger(dados.produto_id) ||
      dados.produto_id < 1
    ) {
      throw ErroDominio.validacao('Identificador de produto inválido.', {
        produto_id: 'O ID do produto deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (
      !Number.isFinite(dados.quantidade) ||
      !Number.isInteger(dados.quantidade) ||
      dados.quantidade < 1
    ) {
      throw ErroDominio.validacao('Quantidade inválida para lançamento.', {
        quantidade: 'A quantidade deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (!this.servicoProdutos) {
      throw ErroDominio.interno(
        'Serviço de produtos não configurado no serviço de comandas.',
      );
    }

    return this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(comandaId, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(
          `Comanda com ID ${comandaId} não encontrada.`,
          { comanda_id: 'Comanda não encontrada.' },
        );
      }

      if (comanda.status !== 'aberta') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_ABERTA',
          'Não é possível lançar itens em comanda que não esteja aberta.',
          { comanda_id: comandaId, status: comanda.status },
        );
      }

      const disponibilidade = await this.servicoProdutos!.consultarDisponibilidade(
        dados.produto_id,
        dados.quantidade,
      );

      if (!disponibilidade.ativo) {
        throw ErroDominio.regraNegocio(
          'PRODUTO_INATIVO',
          'Não é possível lançar um produto inativo na comanda.',
          { produto_id: dados.produto_id },
        );
      }

      if (!disponibilidade.disponivel) {
        throw ErroDominio.conflito(
          'ESTOQUE_INSUFICIENTE',
          'Estoque insuficiente para o produto informado.',
          {
            produto_id: dados.produto_id,
            quantidade_solicitada: dados.quantidade,
            estoque_disponivel: disponibilidade.estoque,
          },
        );
      }

      const itemCriado = await this.repository.lancarItem(
        {
          comanda_id: comandaId,
          produto_id: dados.produto_id,
          nome_copiado: disponibilidade.nome,
          preco_copiado: new Prisma.Decimal(disponibilidade.preco),
          quantidade: dados.quantidade,
        },
        tx,
      );

      return this.formatarItemComanda(itemCriado);
    });
  }

  async ajustarItem(
    comandaId: number,
    itemId: number,
    dados: AjustarItemDados,
  ): Promise<ItemComandaEntidade> {
    if (!Number.isFinite(comandaId) || !Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (!Number.isFinite(itemId) || !Number.isInteger(itemId) || itemId < 1) {
      throw ErroDominio.validacao('Identificador de item inválido.', {
        itemId: 'O ID do item deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (
      !Number.isFinite(dados.quantidade) ||
      !Number.isInteger(dados.quantidade) ||
      dados.quantidade < 1
    ) {
      throw ErroDominio.validacao('Quantidade inválida para ajuste.', {
        quantidade: 'A quantidade deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (!this.servicoProdutos) {
      throw ErroDominio.interno(
        'Serviço de produtos não configurado no serviço de comandas.',
      );
    }

    return this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(comandaId, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(
          `Comanda com ID ${comandaId} não encontrada.`,
          { comanda_id: 'Comanda não encontrada.' },
        );
      }

      if (comanda.status !== 'aberta') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_ABERTA',
          'Não é possível ajustar itens em comanda que não esteja aberta.',
          { comanda_id: comandaId, status: comanda.status },
        );
      }

      const itemExistente = await this.repository.buscarItem(comandaId, itemId, tx);

      if (!itemExistente) {
        throw ErroDominio.naoEncontrado(
          `Item com ID ${itemId} não encontrado na comanda ${comandaId}.`,
          { comanda_id: comandaId, item_id: itemId },
        );
      }

      const delta = dados.quantidade - itemExistente.quantidade;
      if (delta > 0) {
        const disponibilidade = await this.servicoProdutos!.consultarDisponibilidade(
          itemExistente.produto_id,
          delta,
        );

        if (!disponibilidade.ativo) {
          throw ErroDominio.regraNegocio(
            'PRODUTO_INATIVO',
            'Não é possível aumentar a quantidade de um produto inativo.',
            { produto_id: itemExistente.produto_id },
          );
        }

        if (!disponibilidade.disponivel) {
          throw ErroDominio.conflito(
            'ESTOQUE_INSUFICIENTE',
            'Estoque insuficiente para o acréscimo solicitado.',
            {
              produto_id: itemExistente.produto_id,
              acrescimo_solicitado: delta,
              estoque_disponivel: disponibilidade.estoque,
            },
          );
        }
      }

      const itemAtualizado = await this.repository.atualizarItem(
        itemId,
        { quantidade: dados.quantidade },
        tx,
      );

      return this.formatarItemComanda(itemAtualizado);
    });
  }

  async removerItem(comandaId: number, itemId: number): Promise<void> {
    if (!Number.isFinite(comandaId) || !Number.isInteger(comandaId) || comandaId < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (!Number.isFinite(itemId) || !Number.isInteger(itemId) || itemId < 1) {
      throw ErroDominio.validacao('Identificador de item inválido.', {
        itemId: 'O ID do item deve ser um número inteiro maior ou igual a 1.',
      });
    }

    return this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(comandaId, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(
          `Comanda com ID ${comandaId} não encontrada.`,
          { comanda_id: 'Comanda não encontrada.' },
        );
      }

      if (comanda.status !== 'aberta') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_ABERTA',
          'Não é possível remover itens de comanda que não esteja aberta.',
          { comanda_id: comandaId, status: comanda.status },
        );
      }

      const itemExistente = await this.repository.buscarItem(comandaId, itemId, tx);

      if (!itemExistente) {
        throw ErroDominio.naoEncontrado(
          `Item com ID ${itemId} não encontrado na comanda ${comandaId}.`,
          { comanda_id: comandaId, item_id: itemId },
        );
      }

      await this.repository.removerItem(itemId, tx);
    });
  }

  async fechar(id: number, dados: FecharComandaDados): Promise<ComandaEntidade> {
    if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (
      !dados ||
      typeof dados !== 'object' ||
      typeof dados.aplicar_taxa_servico !== 'boolean'
    ) {
      throw ErroDominio.validacao('Dados de fechamento inválidos.', {
        aplicar_taxa_servico: 'O campo aplicar_taxa_servico deve ser booleano.',
      });
    }

    const comandaFormatada = await this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(id, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(`Comanda com ID ${id} não encontrada.`, {
          comanda_id: 'Comanda não encontrada.',
        });
      }

      if (comanda.status !== 'aberta') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_ABERTA',
          'Não é possível fechar uma comanda que não esteja aberta.',
          { comanda_id: id, status: comanda.status },
        );
      }

      const itens = comanda.itens ?? [];
      if (itens.length === 0) {
        throw ErroDominio.conflito(
          'COMANDA_SEM_ITENS',
          'Não é possível fechar comanda sem itens lançados.',
          { comanda_id: id },
        );
      }

      let subtotal = new Prisma.Decimal('0.00');
      for (const item of itens) {
        const precoItem = new Prisma.Decimal(item.preco_copiado as any);
        const subtotalItem = precoItem.mul(item.quantidade);
        subtotal = subtotal.add(subtotalItem);
      }

      let taxaServico = new Prisma.Decimal('0.00');
      if (dados.aplicar_taxa_servico) {
        taxaServico = subtotal
          .mul(new Prisma.Decimal('0.10'))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      }

      const total = subtotal.add(taxaServico);
      const fechadaEm = new Date();

      const comandaFechada = await this.repository.atualizar(
        id,
        {
          status: 'fechada',
          subtotal,
          taxa_servico: taxaServico,
          total,
          fechada_em: fechadaEm,
        },
        tx,
      );

      return this.formatarComanda(comandaFechada);
    });

    // Notificação síncrona pós-commit ao caixa-service via CaixaGateway (ADR-07, RN17)
    if (this.caixaGateway) {
      try {
        const payloadCaixa = {
          mesa: Number(comandaFormatada.mesa),
          garcom_id: comandaFormatada.garcom_id,
          nome_cliente: comandaFormatada.nome_cliente,
          aplicar_taxa_servico: dados.aplicar_taxa_servico,
          subtotal: comandaFormatada.subtotal,
          taxa_servico: comandaFormatada.taxa_servico,
          total: comandaFormatada.total,
          itens: comandaFormatada.itens.map((it) => ({
            item_comanda_id: it.id,
            produto_id: it.produto_id,
            nome: it.nome_copiado,
            preco_unitario: it.preco_copiado,
            quantidade: it.quantidade,
          })),
        };

        const resNotificacao = await this.caixaGateway.notificarFechamento(id, payloadCaixa);
        if (!resNotificacao.sucesso) {
          console.warn(
            `[CaixaGateway] Falha ao notificar fechamento da comanda #${id} ao caixa-service: ${resNotificacao.erro}. Degradação graciosa ativada.`,
          );
          comandaFormatada.integracao_caixa_pendente = true;
          comandaFormatada.avisos = ['integracao_caixa_pendente: true'];
        } else {
          comandaFormatada.integracao_caixa_pendente = false;
        }
      } catch (err: any) {
        console.warn(
          `[CaixaGateway] Erro inesperado ao notificar fechamento da comanda #${id}: ${err?.message}. Degradação graciosa ativada.`,
        );
        comandaFormatada.integracao_caixa_pendente = true;
        comandaFormatada.avisos = ['integracao_caixa_pendente: true'];
      }
    }

    return comandaFormatada;
  }

  async cancelar(id: number): Promise<ComandaEntidade> {
    if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    return this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(id, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(`Comanda com ID ${id} não encontrada.`, {
          comanda_id: 'Comanda não encontrada.',
        });
      }

      if (comanda.status !== 'aberta') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_ABERTA',
          'Apenas comandas abertas podem ser canceladas.',
          { comanda_id: id, status: comanda.status },
        );
      }

      const comandaCancelada = await this.repository.atualizar(
        id,
        {
          status: 'cancelada',
        },
        tx,
      );

      return this.formatarComanda(comandaCancelada);
    });
  }

  async pagar(id: number, dados: PagarComandaDados): Promise<ComandaEntidade> {
    if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    const formasValidas: FormaPagamentoTipo[] = ['dinheiro', 'pix', 'cartao'];
    if (!dados || !formasValidas.includes(dados.forma_pagamento)) {
      throw ErroDominio.validacao('Forma de pagamento inválida.', {
        forma_pagamento: 'A forma de pagamento deve ser dinheiro, pix ou cartao.',
      });
    }

    if (!this.servicoProdutos) {
      throw ErroDominio.interno(
        'Serviço de produtos não configurado no serviço de comandas.',
      );
    }

    const comandaFormatada = await this.repository.executarEmTransacao(async (tx) => {
      const comanda = await this.repository.buscarPorId(id, tx);

      if (!comanda) {
        throw ErroDominio.naoEncontrado(`Comanda com ID ${id} não encontrada.`, {
          comanda_id: 'Comanda não encontrada.',
        });
      }

      if (comanda.status !== 'fechada') {
        throw ErroDominio.conflito(
          'COMANDA_NAO_FECHADA',
          'Apenas comandas com status "fechada" podem receber pagamento.',
          { comanda_id: id, status: comanda.status },
        );
      }

      const itensBaixa = (comanda.itens ?? []).map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
      }));

      if (itensBaixa.length > 0) {
        await this.servicoProdutos!.baixarEstoque(
          {
            comanda_id: id,
            itens: itensBaixa,
            motivo: `VENDA_COMANDA #${id}`,
          },
          tx,
        );
      }

      const pagaEm = new Date();
      const comandaPaga = await this.repository.atualizar(
        id,
        {
          status: 'paga',
          forma_pagamento: dados.forma_pagamento,
          paga_em: pagaEm,
        },
        tx,
      );

      return this.formatarComanda(comandaPaga);
    });

    // Notificação síncrona/assíncrona pós-commit ao gestao-service via GestaoGateway (ADR-01, ADR-07)
    if (this.gestaoGateway) {
      try {
        const payloadGestao = {
          evento_id: crypto.randomUUID(),
          evento: 'comanda.paga',
          versao: 1,
          ocorrido_em:
            comandaFormatada.paga_em instanceof Date
              ? comandaFormatada.paga_em.toISOString()
              : String(comandaFormatada.paga_em || new Date().toISOString()),
          data_hora:
            comandaFormatada.paga_em instanceof Date
              ? comandaFormatada.paga_em.toISOString()
              : String(comandaFormatada.paga_em || new Date().toISOString()),
          timestamp: new Date().toISOString(),
          comanda_id: comandaFormatada.id,
          mesa: Number(comandaFormatada.mesa),
          garcom_id: comandaFormatada.garcom_id,
          forma_pagamento: comandaFormatada.forma_pagamento,
          subtotal: comandaFormatada.subtotal || '0.00',
          valor_subtotal: comandaFormatada.subtotal || '0.00',
          taxa_servico: comandaFormatada.taxa_servico || '0.00',
          total: comandaFormatada.total || '0.00',
          valor_total: comandaFormatada.total || '0.00',
          itens: comandaFormatada.itens.map((item) => ({
            produto_id: item.produto_id,
            nome: item.nome_copiado,
            nome_copiado: item.nome_copiado,
            preco_unitario: item.preco_copiado,
            preco_copiado: item.preco_copiado,
            quantidade: item.quantidade,
            subtotal: new Prisma.Decimal(item.preco_copiado)
              .mul(item.quantidade)
              .toFixed(2),
          })),
        };

        const resGestao = await this.gestaoGateway.notificarComandaPaga(payloadGestao);
        if (!resGestao.sucesso) {
          console.warn(
            `[GestaoGateway] Falha ao notificar pagamento da comanda #${id} ao gestao-service: ${resGestao.erro}. Degradação graciosa ativada.`,
          );
          comandaFormatada.integracao_gestao_pendente = true;
          comandaFormatada.avisos = comandaFormatada.avisos ?? [];
          comandaFormatada.avisos.push('integracao_gestao_pendente: true');
        }
      } catch (err: any) {
        console.warn(
          `[GestaoGateway] Erro inesperado ao notificar pagamento da comanda #${id}: ${err?.message}. Degradação graciosa ativada.`,
        );
        comandaFormatada.integracao_gestao_pendente = true;
        comandaFormatada.avisos = comandaFormatada.avisos ?? [];
        comandaFormatada.avisos.push('integracao_gestao_pendente: true');
      }
    }

    return comandaFormatada;
  }
}
