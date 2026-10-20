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
  },
  { description: 'Serviço e banco de dados operacionais' },
);

export const rotasSaude: FastifyPluginAsync<OpcoesRotasSaude> = async (app, opcoes) => {
  const servidor = app.withTypeProvider<TypeBoxTypeProvider>();

  servidor.get(
    '/health',
    {
      schema: {
        tags: ['Infraestrutura'],
        summary: 'Verificação de saúde do serviço e conexão com o banco de dados',
        description: 'Confirmar disponibilidade.',
        response: {
          200: RespostaSaudeOkSchema,
          503: RespostaErroSchema,
        },
      },
    },
    async (request) => {
      try {
        await opcoes.prisma.$queryRaw`SELECT 1`;
        return { status: 'ok' as const };
      } catch (erro) {
        request.log.error(
          { err: erro },
          'Falha ao verificar conectividade com o banco de dados no /health.',
        );
        throw ErroDominio.servicoIndisponivel(
          'banco',
          'Banco de dados indisponível no momento.',
        );
      }
    },
  );
};
