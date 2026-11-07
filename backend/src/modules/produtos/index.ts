import { FastifyPluginAsync } from 'fastify';
import { ClienteBanco, obterPrisma } from '../../shared/prisma';
import { rotasProdutos } from './rotas';
import { IProdutosRepository, ProdutosRepositoryPrisma } from './produtos.repository';
import { ProdutosService, ServicoProdutos } from './produtos.service';
import { ProdutosController } from './produtos.controller';
import type { IGestaoGateway } from '../../shared/gateways/gestao.gateway';

export interface OpcoesModuloProdutos {
  prisma?: ClienteBanco;
  repositorio?: IProdutosRepository;
  servico?: ServicoProdutos;
  controller?: ProdutosController;
  gestaoGateway?: IGestaoGateway;
}

export const moduloProdutos: FastifyPluginAsync<OpcoesModuloProdutos> = async (
  fastify,
  opcoes = {},
) => {
  const prisma = opcoes.prisma ?? obterPrisma();
  const repositorio = opcoes.repositorio ?? new ProdutosRepositoryPrisma(prisma);
  const servico = opcoes.servico ?? new ProdutosService(repositorio, opcoes.gestaoGateway);
  const controller = opcoes.controller ?? new ProdutosController(servico);

  await fastify.register(rotasProdutos, { servico, controller });
};

export * from './produtos.entity';
export * from './produtos.repository';
export * from './produtos.service';
export * from './produtos.controller';
export * from './schemas';
export * from './servico';
export * from './rotas';