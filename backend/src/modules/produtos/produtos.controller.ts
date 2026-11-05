import { FastifyReply, FastifyRequest } from 'fastify';
import {
  AtualizarProdutoBodyTipo,
  BaixaEstoqueBodyTipo,
  ReporEstoqueBodyTipo,
  ConsultarDisponibilidadeQueryTipo,
  CriarProdutoBodyTipo,
  ListarProdutosQueryTipo,
  ProdutoIdParamsTipo,
} from './schemas';
import { ServicoProdutos } from './produtos.service';
import { ProdutoEntidade } from './produtos.entity';

/**
 * Controller HTTP do Módulo de Produtos.
 * Responsável por orquestrar requisições e respostas HTTP do Fastify.
 */
export class ProdutosController {
  constructor(private readonly service: ServicoProdutos) {}

  private serializarProduto(produto: ProdutoEntidade) {
    return {
      id: produto.id,
      nome: produto.nome,
      categoria: produto.categoria,
      preco: produto.preco,
      estoque: produto.estoque,
      estoque_minimo: produto.estoque_minimo,
      ativo: produto.ativo,
      criado_em:
        produto.criado_em instanceof Date
          ? produto.criado_em.toISOString()
          : String(produto.criado_em),
      atualizado_em:
        produto.atualizado_em instanceof Date
          ? produto.atualizado_em.toISOString()
          : String(produto.atualizado_em),
    };
  }

  async criar(request: FastifyRequest, reply: FastifyReply) {
    const dados = request.body as CriarProdutoBodyTipo;
    const produto = await this.service.criar(dados);
    return reply.status(201).send(this.serializarProduto(produto));
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const filtros = request.query as ListarProdutosQueryTipo;
    const produtos = await this.service.listar(filtros);
    return reply.send(produtos.map((p) => this.serializarProduto(p)));
  }

  async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as ProdutoIdParamsTipo;
    const produto = await this.service.buscarPorId(id);
    return reply.send(this.serializarProduto(produto));
  }

  async atualizar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as ProdutoIdParamsTipo;
    const dados = request.body as AtualizarProdutoBodyTipo;
    const produto = await this.service.atualizar(id, dados);
    return reply.send(this.serializarProduto(produto));
  }

  async inativar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as ProdutoIdParamsTipo;
    const produto = await this.service.inativar(id);
    return reply.send(this.serializarProduto(produto));
  }

  async consultarDisponibilidade(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as ProdutoIdParamsTipo;
    const query = request.query as ConsultarDisponibilidadeQueryTipo;
    const disponibilidade = await this.service.consultarDisponibilidade(id, query.quantidade);
    return reply.send(disponibilidade);
  }

  async baixarEstoque(request: FastifyRequest, reply: FastifyReply) {
    const dados = request.body as BaixaEstoqueBodyTipo;
    await this.service.baixarEstoque(dados);
    return reply.status(200).send({ status: 'ok' });
  }

  async repor(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as ProdutoIdParamsTipo;
    const { quantidade, motivo } = request.body as ReporEstoqueBodyTipo;
    const resultado = await this.service.repor(id, quantidade, motivo);
    return reply.status(200).send({
      produto: this.serializarProduto(resultado.produto),
      movimento: {
        id: resultado.movimento.id,
        produto_id: resultado.movimento.produto_id,
        quantidade: resultado.movimento.quantidade,
        tipo: resultado.movimento.tipo ?? 'ENTRADA_REPOSICAO',
        motivo: resultado.movimento.motivo,
        criado_em:
          resultado.movimento.criado_em instanceof Date
            ? resultado.movimento.criado_em.toISOString()
            : String(resultado.movimento.criado_em),
      },
    });
  }
}
