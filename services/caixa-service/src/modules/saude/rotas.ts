import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ClienteBanco } from '../../shared/prisma';

export const RespostaSaudeOkSchema = Type.Object(
  {
    status: Type.Literal('ok'),
    servico: Type.Literal('caixa-service'),
    banco: Type.Literal('conectado'),
    timestamp: Type.String({ format: 'date-time' }),
  },
  { description: 'Status de saúde com banco conectado' },
);

export const RespostaSaudeErroSchema = Type.Object(
  {
    status: Type.Literal('erro'),
    servico: Type.Literal('caixa-service'),
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
        summary: 'Verificação de saúde do caixa-service',
        description: 'Retorna a disponibilidade do serviço caixa-service e a conectividade com o banco caixa_db.',
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

      if (!conectado) {
        return reply.status(503).send({
          status: 'erro',
          servico: 'caixa-service',
          banco: 'desconectado',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: 'ok',
        servico: 'caixa-service',
        banco: 'conectado',
        timestamp: new Date().toISOString(),
      });
    },
  );
};
