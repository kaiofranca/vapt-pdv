import { ClienteBanco } from '../../shared/prisma';
import { DadosEventoOutbox, gravarEventoOutbox } from '../../shared/messaging/outbox.publisher';
import { CriarFichaInput } from './schemas';

export interface FichaRegistro {
  id: number;
  comandaId: number;
  itemComandaId: number;
  mesa: number;
  garcomId: number;
  nomeGarcom: string | null;
  setor: string;
  produtoId: number;
  nomeProduto: string;
  quantidade: number;
  observacao: string | null;
  status: string;
  recebidoEm: Date;
  iniciadoEm: Date | null;
  prontoEm: Date | null;
  entregueEm: Date | null;
}

export interface ResultadoCriacaoFicha {
  criada: boolean;
  ficha: FichaRegistro;
}

export class FichasRepositorio {
  constructor(private readonly prisma: any) {}

  async executarEmTransacao<T>(fn: (tx: ClienteBanco) => Promise<T>): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(fn);
    }
    return fn(this.prisma);
  }

  async buscarPorItemComandaId(
    itemComandaId: number,
    tx?: ClienteBanco,
  ): Promise<FichaRegistro | null> {
    const cliente = tx ?? this.prisma;
    return cliente.fichaPreparo.findUnique({
      where: { itemComandaId },
    });
  }

  async buscarPorId(id: number): Promise<FichaRegistro | null> {
    return this.prisma.fichaPreparo.findUnique({
      where: { id },
    });
  }

  async criarOuObterFicha(
    dados: CriarFichaInput,
    tx?: ClienteBanco,
  ): Promise<ResultadoCriacaoFicha> {
    const cliente = tx ?? this.prisma;
    const setor = dados.estacao || dados.setor || 'cozinha';
    const nomeGarcom = dados.garcom_nome || dados.nome_garcom || null;

    if (tx && typeof cliente.fichaPreparo?.findUnique === 'function') {
      const fichaExistente = await cliente.fichaPreparo.findUnique({
        where: { itemComandaId: dados.item_comanda_id },
      });
      if (fichaExistente) {
        return { criada: false, ficha: fichaExistente };
      }
    }

    try {
      const fichaCriada = await cliente.fichaPreparo.create({
        data: {
          comandaId: dados.comanda_id,
          itemComandaId: dados.item_comanda_id,
          mesa: dados.mesa,
          garcomId: dados.garcom_id,
          nomeGarcom,
          setor,
          produtoId: dados.produto_id,
          nomeProduto: dados.nome_produto,
          quantidade: dados.quantidade,
          observacao: dados.observacao ?? null,
          status: 'recebido',
        },
      });

      return { criada: true, ficha: fichaCriada };
    } catch (erro: any) {
      if (erro?.code === 'P2002' || String(erro?.message).includes('item_comanda_id')) {
        const fichaExistente = await this.buscarPorItemComandaId(dados.item_comanda_id, tx);
        if (fichaExistente) {
          return { criada: false, ficha: fichaExistente };
        }
      }
      throw erro;
    }
  }

  async listarFichas(filtros: {
    setor?: string;
    statusList?: string[];
    mesa?: number;
  }): Promise<FichaRegistro[]> {
    const where: any = {};

    if (filtros.setor) {
      where.setor = filtros.setor;
    }

    if (filtros.statusList && filtros.statusList.length > 0) {
      where.status = { in: filtros.statusList };
    }

    if (filtros.mesa) {
      where.mesa = filtros.mesa;
    }

    return this.prisma.fichaPreparo.findMany({
      where,
      orderBy: { recebidoEm: 'asc' },
    });
  }

  async contarPorStatus(filtros: { setor?: string }): Promise<Record<string, number>> {
    const where: any = {};
    if (filtros.setor) {
      where.setor = filtros.setor;
    }

    const contagens = await this.prisma.fichaPreparo.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const resultado: Record<string, number> = {
      recebido: 0,
      em_preparo: 0,
      pronto: 0,
    };

    for (const item of contagens) {
      resultado[item.status] = item._count.status;
    }

    return resultado;
  }

  async atualizarStatusFicha(
    id: number,
    status: string,
    camposData: {
      iniciadoEm?: Date;
      prontoEm?: Date;
      entregueEm?: Date;
    },
    eventoOutbox?: DadosEventoOutbox,
    tx?: ClienteBanco,
  ): Promise<FichaRegistro> {
    const data: any = { status };
    if (camposData.iniciadoEm !== undefined) data.iniciadoEm = camposData.iniciadoEm;
    if (camposData.prontoEm !== undefined) data.prontoEm = camposData.prontoEm;
    if (camposData.entregueEm !== undefined) data.entregueEm = camposData.entregueEm;

    const executarAtualizacao = async (cliente: ClienteBanco): Promise<FichaRegistro> => {
      const atualizada = await cliente.fichaPreparo.update({
        where: { id },
        data,
      });

      if (eventoOutbox) {
        await gravarEventoOutbox(cliente, eventoOutbox);
      }

      return atualizada;
    };

    if (tx) {
      return executarAtualizacao(tx);
    }

    if (eventoOutbox) {
      return this.executarEmTransacao(executarAtualizacao);
    }

    return this.prisma.fichaPreparo.update({
      where: { id },
      data,
    });
  }

  async buscarFichasPorComandaId(comandaId: number): Promise<FichaRegistro[]> {
    return this.prisma.fichaPreparo.findMany({
      where: { comandaId },
      orderBy: { recebidoEm: 'asc' },
    });
  }

  async cancelarFichasAtivas(
    filtros: {
      comandaId?: number;
      itemComandaId?: number;
    },
    tx?: ClienteBanco,
  ): Promise<number> {
    if (!filtros.comandaId && !filtros.itemComandaId) {
      return 0;
    }

    const cliente = tx ?? this.prisma;
    const where: any = {
      status: { in: ['recebido', 'em_preparo', 'pronto'] },
    };
    if (filtros.comandaId) {
      where.comandaId = filtros.comandaId;
    }
    if (filtros.itemComandaId) {
      where.itemComandaId = filtros.itemComandaId;
    }

    if (typeof cliente.fichaPreparo?.updateMany === 'function') {
      const res = await cliente.fichaPreparo.updateMany({
        where,
        data: { status: 'cancelado' },
      });
      return res?.count ?? 0;
    }
    return 0;
  }
}
