import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio } from '../../shared/erros';
import {
  AtualizarProdutoDados,
  BaixaEstoqueDados,
  CriarProdutoDados,
  DisponibilidadeProduto,
  FiltrosListagemProdutos,
  ProdutoEntidade,
  ReposicaoEstoqueResultado,
} from './produtos.entity';
import { IProdutosRepository } from './produtos.repository';
import { HttpGestaoGateway, IGestaoGateway } from '../../shared/gateways/gestao.gateway';
import { mensageriaHabilitada, OutboxPublisher } from '../../shared/messaging';

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

export interface ServicoProdutos {
  criar(dados: CriarProdutoDados): Promise<ProdutoEntidade>;
  listar(filtros?: FiltrosListagemProdutos): Promise<ProdutoEntidade[]>;
  buscarPorId(id: number): Promise<ProdutoEntidade>;
  atualizar(id: number, dados: AtualizarProdutoDados): Promise<ProdutoEntidade>;
  inativar(id: number): Promise<ProdutoEntidade>;
  consultarDisponibilidade(id: number, quantidade?: number): Promise<DisponibilidadeProduto>;
  baixarEstoque(dados: BaixaEstoqueDados, tx?: ClienteBanco): Promise<void>;
  repor(id: number, quantidade: number, motivo?: string): Promise<ReposicaoEstoqueResultado>;
}

export class ProdutosService implements ServicoProdutos {
  private readonly gestaoGateway?: IGestaoGateway;
  private readonly outboxPublisher?: OutboxPublisher;
  private readonly usarMensageria: boolean;

  constructor(
    private readonly repository: IProdutosRepository,
    gestaoGateway?: IGestaoGateway,
    outboxPublisher?: OutboxPublisher,
    usarMensageria?: boolean,
  ) {
    this.gestaoGateway = gestaoGateway ?? new HttpGestaoGateway();
    this.outboxPublisher = outboxPublisher;
    this.usarMensageria = usarMensageria ?? mensageriaHabilitada();
  }

  async criar(dados: CriarProdutoDados): Promise<ProdutoEntidade> {
    const nomeLimpo = dados.nome?.trim() ?? '';
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

    const categoriaLimpa = dados.categoria?.trim() ?? '';
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

    return this.repository.criar({
      nome: nomeLimpo,
      categoria: categoriaLimpa,
      preco: new Prisma.Decimal(precoFormatado),
      estoque: dados.estoque,
      estoque_minimo: estoqueMinimo,
    });
  }

  async listar(filtros: FiltrosListagemProdutos = {}): Promise<ProdutoEntidade[]> {
    return this.repository.listar(filtros);
  }

  async buscarPorId(id: number): Promise<ProdutoEntidade> {
    const produto = await this.repository.buscarPorId(id);

    if (!produto) {
      throw ErroDominio.naoEncontrado(`Produto com ID ${id} não encontrado.`, {
        id: 'Produto não encontrado.',
      });
    }

    return produto;
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

    return this.repository.atualizar(id, dadosAtualizacao);
  }

  async inativar(id: number): Promise<ProdutoEntidade> {
    const produto = await this.buscarPorId(id);

    if (!produto.ativo) {
      return produto;
    }

    return this.repository.atualizar(id, { ativo: false });
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

  async baixarEstoque(dados: BaixaEstoqueDados, tx?: ClienteBanco): Promise<void> {
    if (
      !dados ||
      typeof dados !== 'object' ||
      !Number.isFinite(dados.comanda_id) ||
      !Number.isInteger(dados.comanda_id) ||
      dados.comanda_id < 1
    ) {
      throw ErroDominio.validacao('Identificador de comanda inválido.', {
        comanda_id: 'O ID da comanda deve ser um número inteiro maior ou igual a 1.',
      });
    }

    if (!Array.isArray(dados.itens) || dados.itens.length === 0) {
      throw ErroDominio.validacao('Itens para baixa de estoque não informados.', {
        itens: 'A lista de itens deve conter pelo menos um item.',
      });
    }

    for (let i = 0; i < dados.itens.length; i++) {
      const item = dados.itens[i];
      if (
        !item ||
        typeof item !== 'object' ||
        !Number.isFinite(item.produto_id) ||
        !Number.isInteger(item.produto_id) ||
        item.produto_id < 1
      ) {
        throw ErroDominio.validacao(`Identificador de produto inválido no item ${i}.`, {
          [`itens.${i}.produto_id`]: 'O ID do produto deve ser um inteiro maior ou igual a 1.',
        });
      }

      if (
        !Number.isFinite(item.quantidade) ||
        !Number.isInteger(item.quantidade) ||
        item.quantidade < 1
      ) {
        throw ErroDominio.validacao(`Quantidade inválida no item ${i}.`, {
          [`itens.${i}.quantidade`]: 'A quantidade deve ser um inteiro maior ou igual a 1.',
        });
      }
    }

    await this.repository.baixarEstoque(dados, tx);

    if (this.usarMensageria) {
      if (!tx) {
        this.outboxPublisher?.notificarNovoEvento();
      }
    } else if (this.gestaoGateway) {
      for (const item of dados.itens) {
        try {
          const prod = await this.repository.buscarPorId(item.produto_id);
          if (prod) {
            await this.gestaoGateway.notificarEvento({
              evento_id: crypto.randomUUID(),
              evento: 'estoque.movimentado',
              versao: 1,
              ocorrido_em: new Date().toISOString(),
              produto_id: prod.id,
              nome_produto: prod.nome,
              categoria: prod.categoria,
              tipo: 'saida',
              quantidade: -item.quantidade,
              estoque_atual: prod.estoque,
              estoque_minimo: prod.estoque_minimo,
              abaixo_do_minimo: prod.estoque <= prod.estoque_minimo,
            });
          }
        } catch {
        }
      }
    }
  }

  async repor(id: number, quantidade: number, motivo?: string): Promise<ReposicaoEstoqueResultado> {
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw ErroDominio.validacao(
        'A quantidade a repor deve ser um número inteiro maior ou igual a 1.',
        {
          quantidade: 'Valor inválido. Informe um número inteiro positivo.',
        },
      );
    }

    const resultado = await this.repository.reporEstoque(id, quantidade, motivo);

    if (this.usarMensageria) {
      this.outboxPublisher?.notificarNovoEvento();
    } else if (this.gestaoGateway) {
      try {
        const prod = resultado.produto;
        await this.gestaoGateway.notificarEvento({
          evento_id: crypto.randomUUID(),
          evento: 'estoque.movimentado',
          versao: 1,
          ocorrido_em: new Date().toISOString(),
          movimento_id: resultado.movimento.id,
          produto_id: prod.id,
          nome_produto: prod.nome,
          categoria: prod.categoria,
          tipo: 'ENTRADA_REPOSICAO',
          quantidade,
          estoque_atual: prod.estoque,
          estoque_minimo: prod.estoque_minimo,
          abaixo_do_minimo: prod.estoque <= prod.estoque_minimo,
        });
      } catch {
      }
    }

    return resultado;
  }
}
