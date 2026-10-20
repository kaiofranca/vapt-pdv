import { FastifyPluginAsync } from 'fastify';
import { ClienteBanco, obterPrisma } from '../../shared/prisma';
import { rotasProdutos } from './rotas';
import { ServicoProdutos, ServicoProdutosPrisma } from './servico';

export interface OpcoesModuloProdutos {
  prisma?: ClienteBanco;
  servico?: ServicoProdutos;
}

/**
 * Outros módulos (como Comandas) devem consultar disponibilidade e baixar estoque
 * exclusivamente por interfaces de serviço expostas aqui, nunca acessando tabelas de produtos diretamente.
 */
export const moduloProdutos: FastifyPluginAsync<OpcoesModuloProdutos> = async (
  fastify,
  opcoes = {},
) => {
  const servico =
    opcoes.servico ?? new ServicoProdutosPrisma(opcoes.prisma ?? obterPrisma());

  await fastify.register(rotasProdutos, { servico });
};

export * from './schemas';
export * from './servico';
export * from './rotas';
