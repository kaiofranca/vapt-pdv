import { FastifyPluginAsync } from 'fastify';
import { CobrancasService } from './cobrancas.service';
import {
  ListarComandasQuerySchema,
  ListarComandasQuery,
  ComandaParamsSchema,
  ComandaParams,
  FecharComandaBodySchema,
  FecharComandaBody,
  DividirComandaBodySchema,
  DividirComandaBody,
  PagarComandaBodySchema,
  PagarComandaBody,
  ListarComandasRespostaSchema,
  CobrancaDetalheRespostaSchema,
  DividirRespostaSchema,
  PagarComandaRespostaSchema,
  ReciboCompletoRespostaSchema,
} from './schemas';
import { RespostaErroSchema } from '../../shared/erros';

export interface OpcoesRotasCaixa {
  service: CobrancasService;
}

export const rotasCaixa: FastifyPluginAsync<OpcoesRotasCaixa> = async (app, opts) => {
  const { service } = opts;

  // 1. GET /caixa/comandas — Fila de Contas no Caixa e Resumo do Turno (C01, C02, C15)
  app.get<{ Querystring: ListarComandasQuery }>(
    '/caixa/comandas',
    {
      schema: {
        summary: 'Fila de Contas no Caixa e Resumo do Turno',
        description:
          'Retorna a fila de cobranças do Caixa com resumo financeiro consolidado do turno (C01, C02, C15).',
        tags: ['Caixa & Pagamentos'],
        querystring: ListarComandasQuerySchema,
        response: {
          200: ListarComandasRespostaSchema,
          400: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.listar(request.query);
      return reply.status(200).send(resultado);
    },
  );

  // 2. GET /caixa/comandas/:comandaId — Detalhe da Cobrança, Parcelas e Saldo (C03, C05)
  app.get<{ Params: ComandaParams }>(
    '/caixa/comandas/:comandaId',
    {
      schema: {
        summary: 'Detalhe da Cobrança, Parcelas e Saldo',
        description:
          'Retorna o espelho completo da conta selecionada no Caixa, snapshot dos itens e parcelas já pagas (C03, C05).',
        tags: ['Caixa & Pagamentos'],
        params: ComandaParamsSchema,
        response: {
          200: CobrancaDetalheRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.buscarPorComandaId(request.params.comandaId);
      return reply.status(200).send(resultado);
    },
  );

  // 3. POST /caixa/comandas/:comandaId/fechar — Fechamento e Recálculo com Taxa de 10% (C05, C06, RN12)
  app.post<{ Params: ComandaParams; Body: FecharComandaBody }>(
    '/caixa/comandas/:comandaId/fechar',
    {
      schema: {
        summary: 'Recebimento / Recálculo de Fechamento com Taxa de Serviço',
        description:
          'Sincroniza a conta fechada vinda do Core ou recalcula totais no Caixa ao alternar a taxa opcional de 10% (C05, C06, RN12).',
        tags: ['Caixa & Pagamentos'],
        params: ComandaParamsSchema,
        body: FecharComandaBodySchema,
        response: {
          200: CobrancaDetalheRespostaSchema,
          400: RespostaErroSchema,
          409: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.fecharOuRecalcular(
        request.params.comandaId,
        request.body,
      );
      return reply.status(200).send(resultado);
    },
  );

  // 4. POST /caixa/comandas/:comandaId/dividir — Divisão de Conta / Split Payment (C11, RN15, RN19)
  app.post<{ Params: ComandaParams; Body: DividirComandaBody }>(
    '/caixa/comandas/:comandaId/dividir',
    {
      schema: {
        summary: 'Divisão de Conta / Split Payment',
        description:
          'Calcula e registra a divisão do saldo da comanda igualmente entre N pessoas ou por itens selecionados com conservação estrita de 100% dos centavos (C11, RN15, RN19).',
        tags: ['Caixa & Pagamentos'],
        params: ComandaParamsSchema,
        body: DividirComandaBodySchema,
        response: {
          200: DividirRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          409: RespostaErroSchema,
          422: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.dividirConta(
        request.params.comandaId,
        request.body,
      );
      return reply.status(200).send(resultado);
    },
  );

  // 5. POST /caixa/comandas/:comandaId/pagar — Quitação de Parcelas/Integral com Cálculo de Troco (Story 15.4, C04, C07, C10, C11, RN15, RN19, ADR-07)
  app.post<{ Params: ComandaParams; Body: PagarComandaBody }>(
    '/caixa/comandas/:comandaId/pagar',
    {
      schema: {
        summary: 'Registro de Pagamento Único ou Parcelado com Troco',
        description:
          'Registra o pagamento integral ou parcelado da comanda em dinheiro, pix ou cartão. Valida troco em dinheiro e executa baixa atômica no Core ao zerar o saldo (C04, C07, C10, C11, RN15, RN19, ADR-07).',
        tags: ['Caixa & Pagamentos'],
        params: ComandaParamsSchema,
        body: PagarComandaBodySchema,
        response: {
          200: PagarComandaRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          409: RespostaErroSchema,
          422: RespostaErroSchema,
          503: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.pagarComanda(
        request.params.comandaId,
        request.body,
      );
      return reply.status(200).send(resultado);
    },
  );

  // 6. GET /caixa/recibos/:comandaId — Emissão e Consulta do Recibo Operacional Térmico .paper (Story 15.5, C12, RN24)
  app.get<{ Params: ComandaParams }>(
    '/caixa/recibos/:comandaId',
    {
      schema: {
        summary: 'Emissão e Consulta do Recibo Operacional Térmico .paper',
        description:
          'Retorna o comprovante térmico estruturado e texto .paper com código de autenticação único VAPT-YYYYMMDD-MESA-XXXX para comanda liquidada (C12, RN24).',
        tags: ['Caixa & Pagamentos'],
        params: ComandaParamsSchema,
        response: {
          200: ReciboCompletoRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          500: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const resultado = await service.obterRecibo(request.params.comandaId);
      return reply.status(200).send(resultado);
    },
  );
};
