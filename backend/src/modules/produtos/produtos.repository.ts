import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';
import {
  BaixaEstoqueDados,
  FiltrosListagemProdutos,
  ProdutoEntidade,
  ReposicaoEstoqueResultado,
} from './produtos.entity';

/**
 * Função utilitária para garantir que o Decimal retornado pelo Prisma
 * seja convertido para string de 2 casas decimais no domínio (ex: "10.50").
 */
function formatarPrecoParaString(preco: unknown): string {
  if (preco !== null && typeof preco === 'object' && 'toFixed' in (preco as Record<string, unknown>)) {
    return (preco as { toFixed: (casas: number) => string }).toFixed(2);
  }
  if (typeof preco === 'string' && /^\d+(\.\d+)?$/.test(preco.trim())) {
    const [inteiro, decimal = ''] = preco.trim().split('.');
    return `${inteiro}.${decimal.slice(0, 2).padEnd(2, '0')}`;
  }
  if (typeof preco === 'number' && Number.isFinite(preco)) {
    return preco.toFixed(2);
  }
  return String(preco);
}

/**
 * 1. O CONTRATO (Interface)
 * O Service só vai enxergar esta interface. 
 * Isso permite que em testes você simule o banco criando um repositório falso (Mock)!
 */
export interface IProdutosRepository {
  criar(dados: {
    nome: string;
    categoria: string;
    preco: Prisma.Decimal;
    estoque: number;
    estoque_minimo: number;
  }): Promise<ProdutoEntidade>;

  buscarPorId(id: number): Promise<ProdutoEntidade | null>;

  listar(filtros?: FiltrosListagemProdutos): Promise<ProdutoEntidade[]>;

  atualizar(
    id: number,
    dados: {
      nome?: string;
      categoria?: string;
      preco?: Prisma.Decimal;
      estoque?: number;
      estoque_minimo?: number;
      ativo?: boolean;
    },
  ): Promise<ProdutoEntidade>;

  /**
   * Baixa de estoque transacional e idempotente (RN10 / RN18).
   * Decrementa produtos e grava movimentos contábeis na mesma transação.
   */
  baixarEstoque(dados: BaixaEstoqueDados, tx?: ClienteBanco): Promise<void>;

  /**
   * Reposição manual de estoque transacional (M05 / M06 / RF33 / RN10).
   * Incrementa o saldo do produto e gera o registro em movimentos_estoque com tipo ENTRADA_REPOSICAO.
   */
  reporEstoque(
    id: number,
    quantidade: number,
    motivo?: string,
    tx?: ClienteBanco,
  ): Promise<ReposicaoEstoqueResultado>;
}

/**
 * 2. A IMPLEMENTAÇÃO (Prisma ORM)
 * Esta classe sabe conversar com o Prisma e o PostgreSQL.
 */
export class ProdutosRepositoryPrisma implements IProdutosRepository {
  constructor(private readonly prisma: ClienteBanco) {}

  private obterRepositorio(cliente: ClienteBanco = this.prisma) {
    if (!cliente.produto) {
      throw ErroDominio.interno('Repositório de produtos não configurado no cliente do banco.');
    }
    return cliente.produto;
  }

  private obterRepositorioMovimentos(cliente: ClienteBanco = this.prisma) {
    if (!cliente.movimentoEstoque) {
      throw ErroDominio.interno('Repositório de movimentos de estoque não configurado no cliente do banco.');
    }
    return cliente.movimentoEstoque;
  }

  private async executarEmTransacao<T>(operacao: (tx: ClienteBanco) => Promise<T>): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(operacao);
    }
    return operacao(this.prisma);
  }

  private formatarProduto(registro: {
    id: number;
    nome: string;
    categoria: string;
    preco: unknown;
    estoque: number;
    estoque_minimo: number;
    ativo: boolean;
    criado_em: Date;
    atualizado_em: Date;
  }): ProdutoEntidade {
    return {
      id: registro.id,
      nome: registro.nome,
      categoria: registro.categoria,
      preco: formatarPrecoParaString(registro.preco),
      estoque: registro.estoque,
      estoque_minimo: registro.estoque_minimo,
      ativo: registro.ativo,
      criado_em: registro.criado_em,
      atualizado_em: registro.atualizado_em,
    };
  }

  async criar(dados: {
    nome: string;
    categoria: string;
    preco: Prisma.Decimal;
    estoque: number;
    estoque_minimo: number;
  }): Promise<ProdutoEntidade> {
    const repo = this.obterRepositorio();
    const produto = await repo.create({
      data: {
        nome: dados.nome,
        categoria: dados.categoria,
        preco: dados.preco,
        estoque: dados.estoque,
        estoque_minimo: dados.estoque_minimo,
        ativo: true,
      },
    });

    return this.formatarProduto(produto);
  }

  async buscarPorId(id: number): Promise<ProdutoEntidade | null> {
    const repo = this.obterRepositorio();
    const produto = await repo.findUnique({
      where: { id },
    });

    if (!produto) {
      return null;
    }

    return this.formatarProduto(produto);
  }

  async listar(filtros: FiltrosListagemProdutos = {}): Promise<ProdutoEntidade[]> {
    const limit = Math.min(Math.max(filtros.limit ?? 50, 1), 200);
    const offset = Math.max(filtros.offset ?? 0, 0);

    const where: {
      categoria?: string;
      ativo?: boolean;
    } = {};

    if (filtros.categoria !== undefined) {
      where.categoria = filtros.categoria;
    }

    if (filtros.ativo !== undefined) {
      where.ativo = filtros.ativo;
    }

    const repo = this.obterRepositorio();
    const produtos = await repo.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { id: 'asc' },
    });

    return produtos.map((p) => this.formatarProduto(p));
  }

  async atualizar(
    id: number,
    dados: {
      nome?: string;
      categoria?: string;
      preco?: Prisma.Decimal;
      estoque?: number;
      estoque_minimo?: number;
      ativo?: boolean;
    },
  ): Promise<ProdutoEntidade> {
    const repo = this.obterRepositorio();
    const produtoAtualizado = await repo.update({
      where: { id },
      data: dados,
    });

    return this.formatarProduto(produtoAtualizado);
  }

  async baixarEstoque(dados: BaixaEstoqueDados, tx?: ClienteBanco): Promise<void> {
    const executar = async (contexto: ClienteBanco) => {
      const repoMovimentos = this.obterRepositorioMovimentos(contexto);
      const repoProdutos = this.obterRepositorio(contexto);

      for (const item of dados.itens) {
        if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
          continue;
        }

        // Idempotência estrita por (comanda_id, produto_id) - RN10 / RN18
        const movimentoExistente = await repoMovimentos.findFirst({
          where: {
            comanda_id: dados.comanda_id,
            produto_id: item.produto_id,
          },
        });

        if (movimentoExistente) {
          continue;
        }

        // Verifica existência do produto antes de efetuar a baixa
        const produto = await repoProdutos.findUnique({
          where: { id: item.produto_id },
        });

        if (!produto) {
          throw ErroDominio.naoEncontrado(
            `Produto com ID ${item.produto_id} não encontrado.`,
            { produto_id: item.produto_id },
          );
        }

        // Deduz estoque atomicamente
        await repoProdutos.update({
          where: { id: item.produto_id },
          data: {
            estoque: {
              decrement: item.quantidade,
            },
          },
        });

        const motivo = dados.motivo ?? `VENDA_COMANDA #${dados.comanda_id}`;

        // Grava movimento de estoque com tipo 'saida' e motivo padronizado
        await repoMovimentos.create({
          data: {
            produto_id: item.produto_id,
            quantidade: -item.quantidade,
            tipo: 'saida',
            motivo,
            comanda_id: dados.comanda_id,
          },
        });
      }
    };

    if (tx) {
      await executar(tx);
    } else {
      await this.executarEmTransacao(executar);
    }
  }

  async reporEstoque(
    id: number,
    quantidade: number,
    motivo?: string,
    tx?: ClienteBanco,
  ): Promise<ReposicaoEstoqueResultado> {
    const executar = async (contexto: ClienteBanco) => {
      const repoProdutos = this.obterRepositorio(contexto);
      const repoMovimentos = this.obterRepositorioMovimentos(contexto);

      const produtoExistente = await repoProdutos.findUnique({
        where: { id },
      });

      if (!produtoExistente) {
        throw ErroDominio.naoEncontrado(`Produto com ID ${id} não encontrado.`, {
          produto_id: id,
        });
      }

      const produtoAtualizado = await repoProdutos.update({
        where: { id },
        data: {
          estoque: {
            increment: quantidade,
          },
        },
      });

      const motivoFinal = motivo ?? 'ENTRADA_REPOSICAO_MANUAL';

      const movimentoCriado = await repoMovimentos.create({
        data: {
          produto_id: id,
          quantidade,
          tipo: 'ENTRADA_REPOSICAO',
          motivo: motivoFinal,
        },
      });

      return {
        produto: this.formatarProduto(produtoAtualizado),
        movimento: {
          id: movimentoCriado.id,
          produto_id: movimentoCriado.produto_id,
          quantidade: movimentoCriado.quantidade,
          tipo: movimentoCriado.tipo,
          motivo: movimentoCriado.motivo,
          comanda_id: movimentoCriado.comanda_id ?? null,
          criado_em: movimentoCriado.criado_em,
        },
      };
    };

    if (tx) {
      return executar(tx);
    }
    return this.executarEmTransacao(executar);
  }
}
