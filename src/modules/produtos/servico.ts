import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';

export interface ProdutoEntidade {
  id: number;
  nome: string;
  categoria: string;
  preco: string;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

export interface DisponibilidadeProduto {
  id: number;
  nome: string;
  preco: string;
  ativo: boolean;
  estoque: number;
  disponivel: boolean;
}

export interface CriarProdutoDados {
  nome: string;
  categoria: string;
  preco: string | number;
  estoque: number;
  estoque_minimo?: number;
}

export interface AtualizarProdutoDados {
  nome?: string;
  categoria?: string;
  preco?: string | number;
  estoque?: number;
  estoque_minimo?: number;
}

export interface FiltrosListagemProdutos {
  categoria?: string;
  ativo?: boolean;
  limit?: number;
  offset?: number;
}

export interface ServicoProdutos {
  criar(dados: CriarProdutoDados): Promise<ProdutoEntidade>;
  listar(filtros?: FiltrosListagemProdutos): Promise<ProdutoEntidade[]>;
  buscarPorId(id: number): Promise<ProdutoEntidade>;
  atualizar(id: number, dados: AtualizarProdutoDados): Promise<ProdutoEntidade>;
  inativar(id: number): Promise<ProdutoEntidade>;
  consultarDisponibilidade(id: number, quantidade?: number): Promise<DisponibilidadeProduto>;
}

export function normalizarPreco(preco: string | number): string {
  if (typeof preco === 'number') {
    if (!Number.isFinite(preco) || preco < 0 || preco > 99999999.99) {
      throw ErroDominio.validacao('O preço deve ser um valor não negativo e válido.', {
        preco: 'Valor numérico fora dos limites permitidos.',
      });
    }
  }

  const precoStr = typeof preco === 'number' ? preco.toString() : preco.trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(precoStr)) {
    throw ErroDominio.validacao(
      'O preço deve ser um valor não negativo com no máximo 2 casas decimais e até 8 dígitos inteiros.',
      {
        preco: 'Formato inválido. Forneça até duas casas decimais.',
      },
    );
  }

  const [inteiro, decimal = ''] = precoStr.split('.');
  const decimalFormatado = decimal.padEnd(2, '0');
  return `${inteiro}.${decimalFormatado}`;
}

export function formatarPrecoParaString(preco: unknown): string {
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

export class ServicoProdutosPrisma implements ServicoProdutos {
  constructor(private readonly prisma: ClienteBanco) {}

  private obterRepositorio() {
    if (!this.prisma.produto) {
      throw ErroDominio.interno('Repositório de produtos não configurado no cliente do banco.');
    }
    return this.prisma.produto;
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

  async criar(dados: CriarProdutoDados): Promise<ProdutoEntidade> {
    const nomeLimpo = dados.nome.trim();
    if (!nomeLimpo) {
      throw ErroDominio.validacao('O nome do produto não pode ser vazio.', {
        nome: 'O campo não pode ser vazio.',
      });
    }
    if (nomeLimpo.length > 100) {
      throw ErroDominio.validacao('O nome do produto não pode exceder 100 caracteres.', {
        nome: 'O campo deve ter no máximo 100 caracteres.',
      });
    }

    const categoriaLimpa = dados.categoria.trim();
    if (!categoriaLimpa) {
      throw ErroDominio.validacao('A categoria do produto não pode ser vazia.', {
        categoria: 'O campo não pode ser vazio.',
      });
    }
    if (categoriaLimpa.length > 50) {
      throw ErroDominio.validacao('A categoria do produto não pode exceder 50 caracteres.', {
        categoria: 'O campo deve ter no máximo 50 caracteres.',
      });
    }

    const precoFormatado = normalizarPreco(dados.preco);

    if (dados.estoque < 0 || dados.estoque > 2147483647) {
      throw ErroDominio.validacao('O estoque deve ser um número inteiro entre 0 e 2147483647.', {
        estoque: 'O campo deve ser entre 0 e 2147483647.',
      });
    }

    const estoqueMinimo = dados.estoque_minimo ?? 0;
    if (estoqueMinimo < 0 || estoqueMinimo > 2147483647) {
      throw ErroDominio.validacao('O estoque mínimo deve ser um número inteiro entre 0 e 2147483647.', {
        estoque_minimo: 'O campo deve ser entre 0 e 2147483647.',
      });
    }

    const repo = this.obterRepositorio();
    const produto = await repo.create({
      data: {
        nome: nomeLimpo,
        categoria: categoriaLimpa,
        preco: new Prisma.Decimal(precoFormatado),
        estoque: dados.estoque,
        estoque_minimo: estoqueMinimo,
        ativo: true,
      },
    });

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

  async buscarPorId(id: number): Promise<ProdutoEntidade> {
    const repo = this.obterRepositorio();
    const produto = await repo.findUnique({
      where: { id },
    });

    if (!produto) {
      throw ErroDominio.naoEncontrado(`Produto com ID ${id} não encontrado.`, {
        id: 'Produto não encontrado.',
      });
    }

    return this.formatarProduto(produto);
  }

  async atualizar(id: number, dados: AtualizarProdutoDados): Promise<ProdutoEntidade> {
    await this.buscarPorId(id);

    const dadosAtualizacao: {
      nome?: string;
      categoria?: string;
      preco?: Prisma.Decimal;
      estoque?: number;
      estoque_minimo?: number;
    } = {};

    if (dados.nome !== undefined) {
      const nomeLimpo = dados.nome.trim();
      if (!nomeLimpo) {
        throw ErroDominio.validacao('O nome do produto não pode ser vazio.', {
          nome: 'O campo não pode ser vazio.',
        });
      }
      if (nomeLimpo.length > 100) {
        throw ErroDominio.validacao('O nome do produto não pode exceder 100 caracteres.', {
          nome: 'O campo deve ter no máximo 100 caracteres.',
        });
      }
      dadosAtualizacao.nome = nomeLimpo;
    }

    if (dados.categoria !== undefined) {
      const categoriaLimpa = dados.categoria.trim();
      if (!categoriaLimpa) {
        throw ErroDominio.validacao('A categoria do produto não pode ser vazia.', {
          categoria: 'O campo não pode ser vazio.',
        });
      }
      if (categoriaLimpa.length > 50) {
        throw ErroDominio.validacao('A categoria do produto não pode exceder 50 caracteres.', {
          categoria: 'O campo deve ter no máximo 50 caracteres.',
        });
      }
      dadosAtualizacao.categoria = categoriaLimpa;
    }

    if (dados.preco !== undefined) {
      const precoFormatado = normalizarPreco(dados.preco);
      dadosAtualizacao.preco = new Prisma.Decimal(precoFormatado);
    }

    if (dados.estoque !== undefined) {
      if (dados.estoque < 0 || dados.estoque > 2147483647) {
        throw ErroDominio.validacao('O estoque deve ser um número inteiro entre 0 e 2147483647.', {
          estoque: 'O campo deve ser entre 0 e 2147483647.',
        });
      }
      dadosAtualizacao.estoque = dados.estoque;
    }

    if (dados.estoque_minimo !== undefined) {
      if (dados.estoque_minimo < 0 || dados.estoque_minimo > 2147483647) {
        throw ErroDominio.validacao('O estoque mínimo deve ser um número inteiro entre 0 e 2147483647.', {
          estoque_minimo: 'O campo deve ser entre 0 e 2147483647.',
        });
      }
      dadosAtualizacao.estoque_minimo = dados.estoque_minimo;
    }

    if (Object.keys(dadosAtualizacao).length === 0) {
      throw ErroDominio.validacao('Ao menos um campo deve ser fornecido para atualização.', {
        corpo: 'Ao menos um campo deve ser fornecido para atualização.',
      });
    }

    const repo = this.obterRepositorio();
    const produtoAtualizado = await repo.update({
      where: { id },
      data: dadosAtualizacao,
    });

    return this.formatarProduto(produtoAtualizado);
  }

  async inativar(id: number): Promise<ProdutoEntidade> {
    const produto = await this.buscarPorId(id);

    if (!produto.ativo) {
      return produto;
    }

    const repo = this.obterRepositorio();
    const produtoInativado = await repo.update({
      where: { id },
      data: { ativo: false },
    });

    return this.formatarProduto(produtoInativado);
  }

  async consultarDisponibilidade(
    id: number,
    quantidade: number = 1,
  ): Promise<DisponibilidadeProduto> {
    if (
      !Number.isFinite(quantidade) ||
      !Number.isInteger(quantidade) ||
      quantidade <= 0 ||
      quantidade > 2147483647
    ) {
      throw ErroDominio.validacao('A quantidade informada deve ser maior que zero.', {
        quantidade: 'A quantidade deve ser um número inteiro maior que zero.',
      });
    }

    const produto = await this.buscarPorId(id);
    const disponivel = produto.ativo === true && produto.estoque >= quantidade;

    return {
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      ativo: produto.ativo,
      estoque: produto.estoque,
      disponivel,
    };
  }
}
