import { FastifyPluginAsync } from 'fastify';

/**
 * Outros módulos (como Comandas) devem acessar dados de usuários exclusivamente
 * por interfaces de serviço expostas aqui, nunca consultando tabelas diretamente.
 */
export const moduloUsuarios: FastifyPluginAsync = async () => {
  // Rotas e serviços de usuários serão implementados na Story 2.
};
