import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';
import {
  RegistroComandaBanco,
  RegistroItemComandaBanco,
  StatusComandaTipo,
} from './comanda.entity';

export interface IComandasRepository {
  buscarPorId(id: number, tx?: ClienteBanco): Promise<RegistroComandaBanco | null>;
  buscarAbertaPorMesa(mesa: number, tx?: ClienteBanco): Promise<RegistroComandaBanco | null>;
  criar(
    dados: {
      mesa: number;
      nome_cliente: string | null;
      garcom_id: number;
      status: StatusComandaTipo;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco>;
  listar(
    filtros: {
      where: Record<string, unknown>;
      take: number;
      skip: number;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco[]>;
  atualizar(
    id: number,
    dados: Record<string, unknown>,
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco>;
  lancarItem(
    dados: {
      comanda_id: number;
      produto_id: number;
      nome_copiado: string;
      preco_copiado: Prisma.Decimal;
      quantidade: number;
      observacao?: string | null;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco>;
  buscarItem(
    comandaId: number,
    itemId: number,
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco | null>;
  atualizarItem(
    itemId: number,
    dados: { quantidade: number },
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco>;
  removerItem(itemId: number, tx?: ClienteBanco): Promise<void>;
  transferirItens?(
    comandaOrigemId: number,
    comandaDestinoId: number,
    tx?: ClienteBanco,
  ): Promise<void>;
  executarEmTransacao<T>(operacao: (tx: ClienteBanco) => Promise<T>): Promise<T>;
}

export class ComandasRepositoryPrisma implements IComandasRepository {
  constructor(private readonly prisma: ClienteBanco) {}

  private obterRepoComanda(cliente: ClienteBanco = this.prisma) {
    if (!cliente.comanda) {
      throw ErroDominio.interno(
        'Repositório de comandas não configurado no cliente do banco.',
      );
    }
    return cliente.comanda;
  }

  private obterRepoItens(cliente: ClienteBanco = this.prisma) {
    if (!cliente.itemComanda) {
      throw ErroDominio.interno(
        'Repositório de itens de comanda não configurado no cliente do banco.',
      );
    }
    return cliente.itemComanda;
  }

  async buscarPorId(id: number, tx?: ClienteBanco): Promise<RegistroComandaBanco | null> {
    const repo = this.obterRepoComanda(tx);
    const registro = await repo.findUnique({
      where: { id },
      include: {
        itens: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return registro as unknown as RegistroComandaBanco | null;
  }

  async buscarAbertaPorMesa(mesa: number, tx?: ClienteBanco): Promise<RegistroComandaBanco | null> {
    const repo = this.obterRepoComanda(tx);
    const registro = await repo.findFirst({
      where: {
        mesa,
        status: 'aberta',
      },
    });
    return registro as unknown as RegistroComandaBanco | null;
  }

  async criar(
    dados: {
      mesa: number;
      nome_cliente: string | null;
      garcom_id: number;
      status: StatusComandaTipo;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco> {
    const repo = this.obterRepoComanda(tx);
    const novaComanda = await repo.create({
      data: {
        mesa: dados.mesa,
        nome_cliente: dados.nome_cliente,
        garcom_id: dados.garcom_id,
        status: dados.status,
      },
      include: {
        itens: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return novaComanda as unknown as RegistroComandaBanco;
  }

  async listar(
    filtros: {
      where: Record<string, unknown>;
      take: number;
      skip: number;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco[]> {
    const repo = this.obterRepoComanda(tx);
    const registros = await repo.findMany({
      where: filtros.where,
      include: {
        itens: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ aberta_em: 'desc' }, { id: 'desc' }],
      take: filtros.take,
      skip: filtros.skip,
    });
    return registros as unknown as RegistroComandaBanco[];
  }

  async atualizar(
    id: number,
    dados: Record<string, unknown>,
    tx?: ClienteBanco,
  ): Promise<RegistroComandaBanco> {
    const repo = this.obterRepoComanda(tx);
    const atualizada = await repo.update({
      where: { id },
      data: dados,
      include: {
        itens: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return atualizada as unknown as RegistroComandaBanco;
  }

  async lancarItem(
    dados: {
      comanda_id: number;
      produto_id: number;
      nome_copiado: string;
      preco_copiado: Prisma.Decimal;
      quantidade: number;
      observacao?: string | null;
    },
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco> {
    const repo = this.obterRepoItens(tx);
    const itemCriado = await repo.create({
      data: {
        comanda_id: dados.comanda_id,
        produto_id: dados.produto_id,
        nome_copiado: dados.nome_copiado,
        preco_copiado: dados.preco_copiado,
        quantidade: dados.quantidade,
        observacao: dados.observacao ?? null,
      },
    });
    return itemCriado as unknown as RegistroItemComandaBanco;
  }

  async buscarItem(
    comandaId: number,
    itemId: number,
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco | null> {
    const repo = this.obterRepoItens(tx);
    const item = await repo.findFirst({
      where: {
        id: itemId,
        comanda_id: comandaId,
      },
    });
    return item as unknown as RegistroItemComandaBanco | null;
  }

  async atualizarItem(
    itemId: number,
    dados: { quantidade: number },
    tx?: ClienteBanco,
  ): Promise<RegistroItemComandaBanco> {
    const repo = this.obterRepoItens(tx);
    const itemAtualizado = await repo.update({
      where: { id: itemId },
      data: dados,
    });
    return itemAtualizado as unknown as RegistroItemComandaBanco;
  }

  async removerItem(itemId: number, tx?: ClienteBanco): Promise<void> {
    const repo = this.obterRepoItens(tx);
    await repo.delete({
      where: { id: itemId },
    });
  }

  async transferirItens(
    comandaOrigemId: number,
    comandaDestinoId: number,
    tx?: ClienteBanco,
  ): Promise<void> {
    const repo = this.obterRepoItens(tx);
    await repo.updateMany({
      where: { comanda_id: comandaOrigemId },
      data: { comanda_id: comandaDestinoId },
    });
  }

  async executarEmTransacao<T>(
    operacao: (tx: ClienteBanco) => Promise<T>,
  ): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(operacao);
    }
    return operacao(this.prisma);
  }
}
