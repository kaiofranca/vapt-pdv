import { FastifyReply, FastifyRequest } from 'fastify';
import { GestaoService } from './gestao.service';
import { EnvelopeEventoOperacional } from './schemas';

export class GestaoController {
  constructor(private readonly service: GestaoService) {}

  async ingerirEvento(
    req: FastifyRequest<{ Body: EnvelopeEventoOperacional }>,
    reply: FastifyReply,
  ): Promise<void> {
    const resultado = await this.service.processarEvento(req.body);
    const statusCode = resultado.duplicado ? 200 : 202;
    return reply.status(statusCode).send(resultado);
  }

  async obterResumoDiario(
    req: FastifyRequest<{ Querystring: { data?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { data } = req.query;
    const resumo = await this.service.obterResumoDiario(data);
    return reply.status(200).send(resumo);
  }

  async obterRankingProdutos(
    req: FastifyRequest<{ Querystring: { limite?: number; categoria?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { limite, categoria } = req.query;
    const ranking = await this.service.obterRankingProdutos(limite, categoria);
    return reply.status(200).send(ranking);
  }

  async obterDesempenhoGarcons(
    _req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const desempenho = await this.service.obterDesempenhoGarcons();
    return reply.status(200).send(desempenho);
  }

  async obterAlertasEstoque(
    req: FastifyRequest<{ Querystring: { apenas_ativos?: boolean } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { apenas_ativos } = req.query;
    const alertas = await this.service.obterAlertasEstoque(apenas_ativos);
    return reply.status(200).send(alertas);
  }

  async exportarRelatorio(
    req: FastifyRequest<{
      Querystring: {
        tipo?: 'faturamento' | 'produtos' | 'garcons' | 'alertas';
        formato?: 'csv' | 'json';
        de?: string;
        ate?: string;
      };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const { tipo, formato, de, ate } = req.query;
    const { dados, contentType, filename } = await this.service.exportarRelatorio(tipo, formato, de, ate);

    reply.header('Content-Type', contentType);
    if (formato === 'csv') {
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    }

    return reply.status(200).send(dados);
  }
}
