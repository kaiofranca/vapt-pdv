import { FastifyPluginAsync } from 'fastify';
import { ClienteBanco, obterPrisma } from '../../shared/prisma';
import { rotasUsuarios } from './rotas';
import { ServicoUsuarios, ServicoUsuariosPrisma } from './servico';

export interface OpcoesModuloUsuarios {
  prisma?: ClienteBanco;
  servico?: ServicoUsuarios;
}

export const moduloUsuarios: FastifyPluginAsync<OpcoesModuloUsuarios> = async (
  fastify,
  opcoes,
) => {
  const servico =
    opcoes.servico ?? new ServicoUsuariosPrisma(opcoes.prisma ?? obterPrisma());

  await fastify.register(rotasUsuarios, { servico });
};

export * from './schemas';
export * from './servico';
export * from './rotas';
