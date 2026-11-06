import { FastifyReply, FastifyRequest } from 'fastify';
import {
  AjustarItemDados,
  CancelarComandaDados,
  ComandaEntidade,
  CriarComandaDados,
  FecharComandaDados,
  FiltrosListagemComandas,
  ItemComandaEntidade,
  LancarItemDados,
  PagarComandaDados,
} from './comanda.entity';
import { ServicoComandas } from './comandas.service';

export function serializarComanda(comanda: ComandaEntidade) {
  return {
    id: comanda.id,
    mesa: comanda.mesa,
    nome_cliente: comanda.nome_cliente,
    garcom_id: comanda.garcom_id,
    status: comanda.status,
    subtotal: comanda.subtotal,
    taxa_servico: comanda.taxa_servico,
    total: comanda.total,
    forma_pagamento: comanda.forma_pagamento,
    aberta_em:
      comanda.aberta_em instanceof Date
        ? comanda.aberta_em.toISOString()
        : String(comanda.aberta_em),
    fechada_em:
      comanda.fechada_em === null
        ? null
        : comanda.fechada_em instanceof Date
          ? comanda.fechada_em.toISOString()
          : String(comanda.fechada_em),
    paga_em:
      comanda.paga_em === null
        ? null
        : comanda.paga_em instanceof Date
          ? comanda.paga_em.toISOString()
          : String(comanda.paga_em),
    cancelada_em:
      comanda.cancelada_em === null || comanda.cancelada_em === undefined
        ? null
        : comanda.cancelada_em instanceof Date
          ? comanda.cancelada_em.toISOString()
          : String(comanda.cancelada_em),
    motivo_cancelamento: comanda.motivo_cancelamento ?? null,
    itens: comanda.itens.map((item) => ({
      id: item.id,
      produto_id: item.produto_id,
      nome_copiado: item.nome_copiado,
      preco_copiado: item.preco_copiado,
      quantidade: item.quantidade,
      observacao: item.observacao ?? null,
    })),
    ...(comanda.integracao_caixa_pendente !== undefined
      ? { integracao_caixa_pendente: comanda.integracao_caixa_pendente }
      : {}),
    ...(comanda.integracao_gestao_pendente !== undefined
      ? { integracao_gestao_pendente: comanda.integracao_gestao_pendente }
      : {}),
    ...(comanda.avisos !== undefined ? { avisos: comanda.avisos } : {}),
  };
}

export function serializarItem(item: ItemComandaEntidade) {
  return {
    id: item.id,
    produto_id: item.produto_id,
    nome_copiado: item.nome_copiado,
    preco_copiado: item.preco_copiado,
    quantidade: item.quantidade,
    observacao: item.observacao ?? null,
  };
}

export class ComandasController {
  constructor(private readonly service: ServicoComandas) {}

  async abrir(request: FastifyRequest, reply: FastifyReply) {
    const dados = request.body as CriarComandaDados;
    const comanda = await this.service.abrir(dados);
    return reply.status(201).send(serializarComanda(comanda));
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const filtros = request.query as FiltrosListagemComandas;
    const comandas = await this.service.listar(filtros);
    return reply.send(comandas.map(serializarComanda));
  }

  async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const comanda = await this.service.buscarPorId(id);
    return reply.send(serializarComanda(comanda));
  }

  async lancarItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const dados = request.body as LancarItemDados;
    const item = await this.service.lancarItem(id, dados);
    return reply.status(201).send(serializarItem(item));
  }

  async ajustarItem(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = request.params as { id: number; itemId: number };
    const dados = request.body as AjustarItemDados;
    const item = await this.service.ajustarItem(id, itemId, dados);
    return reply.send(serializarItem(item));
  }

  async removerItem(request: FastifyRequest, reply: FastifyReply) {
    const { id, itemId } = request.params as { id: number; itemId: number };
    await this.service.removerItem(id, itemId);
    return reply.status(204).send();
  }

  async fechar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const dados = request.body as FecharComandaDados;
    const comanda = await this.service.fechar(id, dados);
    return reply.send(serializarComanda(comanda));
  }

  async cancelar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const dados = request.body as CancelarComandaDados | undefined;
    const comanda = await this.service.cancelar(id, dados);
    return reply.send(serializarComanda(comanda));
  }

  async pagar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const dados = request.body as PagarComandaDados;
    const comanda = await this.service.pagar(id, dados);
    return reply.send(serializarComanda(comanda));
  }

  async transferirMesa(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const { nova_mesa } = request.body as { nova_mesa: string | number };
    const comanda = await this.service.transferirMesa(id, nova_mesa);
    return reply.send(serializarComanda(comanda));
  }

  async mesclarComandas(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: number };
    const { comanda_origem_id } = request.body as { comanda_origem_id: number };
    const comanda = await this.service.mesclarComandas(id, comanda_origem_id);
    return reply.send(serializarComanda(comanda));
  }
}
