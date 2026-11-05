import { FastifyPluginAsync } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { ClienteBanco } from '../../shared/prisma';
import { ErroDominio, RespostaErroSchema } from '../../shared/erros';

export interface OpcoesRotasSaude {
  prisma: ClienteBanco;
}

const RespostaSaudeOkSchema = Type.Object(
  {
    status: Type.Literal('ok'),
    servico: Type.Literal('kds-service'),
    banco: Type.Literal('conectado'),
    timestamp: Type.String({ description: 'Data/hora ISO 8601' }),
  },
  { description: 'Microsserviço KDS e banco de dados operacionais' },
);

export const rotasSaude: FastifyPluginAsync<OpcoesRotasSaude> = async (app, opcoes) => {
  const servidor = app.withTypeProvider<TypeBoxTypeProvider>();

  servidor.get(
    '/health',
    {
      schema: {
        tags: ['Saúde'],
        summary: 'Verificação de integridade do microsserviço kds-service e do banco kds_db',
        response: {
          200: RespostaSaudeOkSchema,
          503: RespostaErroSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await opcoes.prisma.$queryRaw`SELECT 1`;
        return {
          status: 'ok' as const,
          servico: 'kds-service' as const,
          banco: 'conectado' as const,
          timestamp: new Date().toISOString(),
        };
      } catch (erro) {
        request.log.error(
          { err: erro },
          'Falha ao verificar conectividade com o banco de dados kds_db.',
        );
        throw ErroDominio.servicoIndisponivel(
          'banco',
          'Banco de dados kds_db indisponível no momento.',
        );
      }
    },
  );
};

