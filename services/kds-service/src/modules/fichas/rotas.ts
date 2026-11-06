import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import {
  AtualizarStatusFichaSchema,
  CriarFichaSchema,
  FichaRespostaSchema,
  ParamsComandaIdSchema,
  ParamsFichaIdSchema,
  RespostaPendenciasComandaSchema,
} from './schemas';
import { FichasRepositorio } from './repositorio';
import { FichasServico } from './servico';
import { RespostaErroSchema } from '../../shared/erros';

export interface OpcoesRotasFichas {
  prisma: any;
}

const QueryFilaSchema = Type.Object({
  estacao: Type.Optional(Type.Union([Type.Literal('cozinha'), Type.Literal('bar')])),
  setor: Type.Optional(Type.Union([Type.Literal('cozinha'), Type.Literal('bar')])),
  status: Type.Optional(Type.String({ description: 'Status único ou separados por vírgula' })),
  mesa: Type.Optional(Type.Integer({ minimum: 1 })),
});

const FichaFilaItemSchema = Type.Intersect([
  FichaRespostaSchema,
  Type.Object({
    tempo_decorrido_segundos: Type.Integer(),
    sla_status: Type.Union([
      Type.Literal('normal'),
      Type.Literal('atencao'),
      Type.Literal('atrasado'),
    ]),
  }),
]);

const RespostaFilaSchema = Type.Object({
  fichas: Type.Array(FichaFilaItemSchema),
  resumo: Type.Record(Type.String(), Type.Integer()),
});

export const rotasFichas: FastifyPluginAsync<OpcoesRotasFichas> = async (app, opcoes) => {
  const servidor = app.withTypeProvider<TypeBoxTypeProvider>();
  const repositorio = new FichasRepositorio(opcoes.prisma);
  const servico = new FichasServico(repositorio);

  // POST /kds/fichas — Recebimento síncrono e idempotente (Story 14.2)
  servidor.post(
    '/kds/fichas',
    {
      schema: {
        tags: ['Fichas'],
        summary: 'Recebimento síncrono e idempotente de fichas de preparo',
        description: 'Cria nova ficha ou retorna existente de forma idempotente via item_comanda_id',
        body: CriarFichaSchema,
        response: {
          201: FichaRespostaSchema,
          200: FichaRespostaSchema,
          400: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const { criada, ficha } = await servico.registrarFicha(request.body);
      const statusCode = criada ? 201 : 200;
      return reply.status(statusCode).send(ficha);
    },
  );

  // GET /kds/fichas e alias /kds/fila — Consulta FIFO com SLA (Story 14.3)
  const filaHandler = async (request: any, reply: any) => {
    const resultado = await servico.consultarFila(request.query);
    return reply.status(200).send(resultado);
  };

  servidor.get(
    '/kds/fichas',
    {
      schema: {
        tags: ['Fichas'],
        summary: 'Consulta da fila de preparo em ordem FIFO com cálculo de SLA',
        querystring: QueryFilaSchema,
        response: {
          200: RespostaFilaSchema,
        },
      },
    },
    filaHandler,
  );

  servidor.get(
    '/kds/fila',
    {
      schema: {
        tags: ['Fichas'],
        summary: 'Alias para consulta da fila de preparo (/kds/fichas)',
        querystring: QueryFilaSchema,
        response: {
          200: RespostaFilaSchema,
        },
      },
    },
    filaHandler,
  );

  // PATCH /kds/fichas/:id/status — Transição de estado de preparo (Story 14.4)
  servidor.patch(
    '/kds/fichas/:id/status',
    {
      schema: {
        tags: ['Fichas'],
        summary: 'Atualização do status de preparo de uma ficha KDS',
        params: ParamsFichaIdSchema,
        body: AtualizarStatusFichaSchema,
        response: {
          200: FichaRespostaSchema,
          400: RespostaErroSchema,
          404: RespostaErroSchema,
          422: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      const ficha = await servico.atualizarStatus(
        request.params.id,
        request.body.status,
        request.body.alterado_por,
      );
      return reply.status(200).send(ficha);
    },
  );

  // GET /kds/comandas/:comandaId/pendencias e alias /status-preparo — Consulta de pendências (Story 14.5)
  const pendenciasHandler = async (request: any, reply: any) => {
    const pendencias = await servico.consultarPendenciasComanda(request.params.comandaId);
    return reply.status(200).send(pendencias);
  };

  servidor.get(
    '/kds/comandas/:comandaId/pendencias',
    {
      schema: {
        tags: ['Comandas'],
        summary: 'Verificação de pendências de preparo da comanda no KDS',
        params: ParamsComandaIdSchema,
        response: {
          200: RespostaPendenciasComandaSchema,
          400: RespostaErroSchema,
        },
      },
    },
    pendenciasHandler,
  );

  servidor.get(
    '/kds/comandas/:comandaId/status-preparo',
    {
      schema: {
        tags: ['Comandas'],
        summary: 'Alias para verificação de pendências (/kds/comandas/:comandaId/pendencias)',
        params: ParamsComandaIdSchema,
        response: {
          200: RespostaPendenciasComandaSchema,
          400: RespostaErroSchema,
        },
      },
    },
    pendenciasHandler,
  );
};

