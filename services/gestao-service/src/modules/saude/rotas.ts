import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ClienteBanco } from '../../shared/prisma';

export const RespostaSaudeOkSchema = Type.Object(
  {
    status: Type.Literal('ok'),
    servico: Type.Literal('gestao-service'),
    banco: Type.Literal('conectado'),
    timestamp: Type.String({ format: 'date-time' }),
  },
  { description: 'Status de saúde com banco conectado' },
);

export const RespostaSaudeErroSchema = Type.Object(
  {
    status: Type.Literal('erro'),
    servico: Type.Literal('gestao-service'),
    banco: Type.Literal('desconectado'),
    timestamp: Type.String({ format: 'date-time' }),
  },
  { description: 'Status de saúde com banco desconectado' },
);

export interface OpcoesRotasSaude {
  prisma?: ClienteBanco;
}

export const rotasSaude: FastifyPluginAsync<OpcoesRotasSaude> = async (app, opts) => {
  app.get(
    '/health',
    {
      schema: {
        summary: 'Verificação de saúde do gestao-service',
        description: 'Retorna a disponibilidade do serviço gestao-service e a conectividade com o banco gestao_db.',
        tags: ['Saúde'],
        response: {
          200: RespostaSaudeOkSchema,
          503: RespostaSaudeErroSchema,
        },
      },
    },
    async (_req, reply) => {
      let conectado = true;
      if (opts.prisma) {
        try {
          await opts.prisma.$queryRaw`SELECT 1`;
        } catch {
          conectado = false;
        }
      }

      const statusCodigo = conectado ? 200 : 503;
      return reply.status(statusCodigo).send({
        status: conectado ? 'ok' : 'erro',
        servico: 'gestao-service',
        banco: conectado ? 'conectado' : 'desconectado',
        timestamp: new Date().toISOString(),
      });
    },
  );
};
