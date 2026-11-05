import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { CriarFichaSchema, FichaRespostaSchema } from './schemas';
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
};

