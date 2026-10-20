import { FastifyPluginAsync } from 'fastify';

/**
 * Outros módulos (como Comandas) devem consultar disponibilidade e baixar estoque
 * exclusivamente por interfaces de serviço expostas aqui, nunca acessando tabelas de produtos diretamente.
 */
export const moduloProdutos: FastifyPluginAsync = async () => {

};
