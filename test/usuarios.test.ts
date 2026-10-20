import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { ServicoUsuariosPrisma } from '../src/modules/usuarios/servico';

interface UsuarioSimulado {
  id: number;
  nome: string;
  perfil: 'garcom' | 'caixa' | 'gerente';
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

function criarPrismaComUsuariosMock(usuariosIniciais: UsuarioSimulado[] = []) {
  const usuarios = usuariosIniciais.map((u) => ({ ...u }));
  let proximoId = usuarios.length > 0 ? Math.max(...usuarios.map((u) => u.id)) + 1 : 1;

  const usuarioMock = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: { nome: string; perfil: 'garcom' | 'caixa' | 'gerente'; ativo?: boolean };
      }) => {
        const novo: UsuarioSimulado = {
          id: proximoId++,
          nome: data.nome,
          perfil: data.perfil,
          ativo: data.ativo ?? true,
          criado_em: new Date(),
          atualizado_em: new Date(),
        };
        usuarios.push(novo);
        return novo;
      },
    ),
    findMany: vi.fn(
      async (params?: {
        where?: { perfil?: string; ativo?: boolean };
        take?: number;
        skip?: number;
      }) => {
        let resultado = [...usuarios];
        if (params?.where?.perfil !== undefined) {
          resultado = resultado.filter((u) => u.perfil === params.where?.perfil);
        }
        if (params?.where?.ativo !== undefined) {
          resultado = resultado.filter((u) => u.ativo === params.where?.ativo);
        }
        if (params?.skip !== undefined) {
          resultado = resultado.slice(params.skip);
        }
        if (params?.take !== undefined) {
          resultado = resultado.slice(0, params.take);
        }
        return resultado;
      },
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const encontrado = usuarios.find((u) => u.id === where.id);
      return encontrado ? { ...encontrado } : null;
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<UsuarioSimulado>;
      }) => {
        const index = usuarios.findIndex((u) => u.id === where.id);
        if (index === -1) {
          throw new Error('Record to update not found.');
        }
        usuarios[index] = {
          ...usuarios[index],
          ...data,
          atualizado_em: new Date(),
        };
        return { ...usuarios[index] };
      },
    ),
  };

  const prisma: ClienteBanco = {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    usuario: usuarioMock as unknown as ClienteBanco['usuario'],
  };

  return { prisma, usuarioMock, usuarios };
}

describe('CRUD de Usuários com Perfil (Story 2 - CAP-2)', () => {
  describe('Criação de Usuário (POST /usuarios)', () => {
    it('Criar usuário válido: POST /usuarios com nome e perfil garcom retorna 201 com ativo=true', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          nome: 'Carlos',
          perfil: 'garcom',
        },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.nome).toBe('Carlos');
      expect(corpo.perfil).toBe('garcom');
      expect(corpo.ativo).toBe(true);
      expect(corpo.criado_em).toBeDefined();
      expect(corpo.atualizado_em).toBeDefined();

      await app.close();
    });

    it('Criar com perfil inválido: POST /usuarios retorna 400 VALIDACAO detalhando o campo perfil', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          nome: 'Carlos',
          perfil: 'admin',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.perfil).toBeDefined();

      await app.close();
    });

    it('Criar sem nome: POST /usuarios sem o campo nome retorna 400 VALIDACAO indicando ausência', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          perfil: 'caixa',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.nome).toBeDefined();

      await app.close();
    });

    it('Criar com nome vazio: POST /usuarios com nome="" retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          nome: '',
          perfil: 'caixa',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.nome).toBeDefined();

      await app.close();
    });

    it('Criar com nome superior a 100 caracteres: POST /usuarios retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          nome: 'A'.repeat(101),
          perfil: 'garcom',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.nome).toBeDefined();

      await app.close();
    });

    it('Criar com nome composto apenas por espaços: POST /usuarios retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios',
        payload: {
          nome: '   ',
          perfil: 'gerente',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.nome).toBeDefined();

      await app.close();
    });
  });

  describe('Listagem de Usuários (GET /usuarios)', () => {
    it('Listar usuários: GET /usuarios?perfil=garcom&ativo=true&limit=10&offset=0 retorna lista filtrada', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'João', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
        { id: 2, nome: 'Maria', perfil: 'caixa', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
        { id: 3, nome: 'José', perfil: 'garcom', ativo: false, criado_em: dataCriacao, atualizado_em: dataCriacao },
        { id: 4, nome: 'Pedro', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios?perfil=garcom&ativo=true&limit=10&offset=0',
      });

      expect(resposta.statusCode).toBe(200);
      const lista = resposta.json();
      expect(Array.isArray(lista)).toBe(true);
      expect(lista).toHaveLength(2);
      expect(lista.map((u: { id: number }) => u.id)).toEqual([1, 4]);
      expect(lista.every((u: { perfil: string; ativo: boolean }) => u.perfil === 'garcom' && u.ativo === true)).toBe(true);

      await app.close();
    });

    it('Listar com paginação inválida: GET /usuarios?limit=0 retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios?limit=0',
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.limit).toBeDefined();

      await app.close();
    });

    it('Listar com limit superior ao máximo permitido: GET /usuarios?limit=500 retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios?limit=500',
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.limit).toBeDefined();

      await app.close();
    });
  });

  describe('Consulta de Usuário por ID (GET /usuarios/:id)', () => {
    it('Buscar por id existente: GET /usuarios/1 retorna 200 com os dados do usuário', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/1',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.nome).toBe('Carlos');
      expect(corpo.perfil).toBe('garcom');
      expect(corpo.ativo).toBe(true);

      await app.close();
    });

    it('Buscar por id não numérico: GET /usuarios/abc retorna 400 VALIDACAO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/abc',
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.id).toBeDefined();

      await app.close();
    });

    it('Buscar por id inexistente: GET /usuarios/999 retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/999',
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');

      await app.close();
    });
  });

  describe('Atualização Parcial de Usuário (PATCH /usuarios/:id)', () => {
    it('Atualizar perfil válido: PATCH /usuarios/1 altera o perfil e retorna 200', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/1',
        payload: {
          perfil: 'gerente',
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.perfil).toBe('gerente');
      expect(corpo.nome).toBe('Carlos');

      await app.close();
    });

    it('Atualizar nome válido: PATCH /usuarios/1 altera o nome e retorna 200', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/1',
        payload: {
          nome: 'Carlos Silva',
        },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.nome).toBe('Carlos Silva');
      expect(corpo.perfil).toBe('garcom');

      await app.close();
    });

    it('Atualizar sem campos: PATCH /usuarios/1 com {} retorna 400 VALIDACAO', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/1',
        payload: {},
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');

      await app.close();
    });

    it('Atualizar com nome superior a 100 caracteres: PATCH /usuarios/1 retorna 400 VALIDACAO', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/1',
        payload: {
          nome: 'B'.repeat(101),
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');
      expect(corpo.erro.detalhes.nome).toBeDefined();

      await app.close();
    });

    it('Atualizar com nome vazio: PATCH /usuarios/1 com nome="" retorna 400 VALIDACAO', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/1',
        payload: {
          nome: '',
        },
      });

      expect(resposta.statusCode).toBe(400);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('VALIDACAO');

      await app.close();
    });

    it('Atualizar id inexistente: PATCH /usuarios/999 retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'PATCH',
        url: '/usuarios/999',
        payload: {
          nome: 'Novo',
        },
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');

      await app.close();
    });
  });

  describe('Inativação de Usuário (POST /usuarios/:id/inativar)', () => {
    it('Inativar usuário ativo: POST /usuarios/1/inativar altera ativo para false', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios/1/inativar',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.ativo).toBe(false);

      await app.close();
    });

    it('Inativar já inativo: POST /usuarios/1/inativar é idempotente e retorna 200 com ativo=false sem alterar novamente', async () => {
      const dataCriacao = new Date();
      const { prisma, usuarioMock } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos', perfil: 'garcom', ativo: false, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios/1/inativar',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo.id).toBe(1);
      expect(corpo.ativo).toBe(false);
      // Garantir idempotência: update não deve ser chamado se já inativo
      expect(usuarioMock.update).not.toHaveBeenCalled();

      await app.close();
    });

    it('Inativar inexistente: POST /usuarios/999/inativar retorna 404 NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'POST',
        url: '/usuarios/999/inativar',
      });

      expect(resposta.statusCode).toBe(404);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('NAO_ENCONTRADO');

      await app.close();
    });
  });

  describe('Validação Interna de Garçom (GET /usuarios/:id/validar-garcom)', () => {
    it('Validar garçom válido: GET /usuarios/1/validar-garcom com garçom ativo retorna 200 { id, nome, valido: true }', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos Garçom', perfil: 'garcom', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/1/validar-garcom',
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();
      expect(corpo).toEqual({
        id: 1,
        nome: 'Carlos Garçom',
        valido: true,
      });

      await app.close();
    });

    it('Validar garçom inexistente: GET /usuarios/999/validar-garcom retorna 422 GARCOM_INVALIDO com motivo USUARIO_NAO_ENCONTRADO', async () => {
      const { prisma } = criarPrismaComUsuariosMock();
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/999/validar-garcom',
      });

      expect(resposta.statusCode).toBe(422);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
      expect(corpo.erro.detalhes.motivo).toBe('USUARIO_NAO_ENCONTRADO');

      await app.close();
    });

    it('Validar garçom inativo: GET /usuarios/1/validar-garcom com ativo=false retorna 422 GARCOM_INVALIDO com motivo USUARIO_INATIVO', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 1, nome: 'Carlos Inativo', perfil: 'garcom', ativo: false, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/1/validar-garcom',
      });

      expect(resposta.statusCode).toBe(422);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
      expect(corpo.erro.detalhes.motivo).toBe('USUARIO_INATIVO');

      await app.close();
    });

    it('Validar usuário que não é garçom: GET /usuarios/2/validar-garcom com perfil caixa retorna 422 GARCOM_INVALIDO com motivo PERFIL_INVALIDO', async () => {
      const dataCriacao = new Date();
      const { prisma } = criarPrismaComUsuariosMock([
        { id: 2, nome: 'Maria Caixa', perfil: 'caixa', ativo: true, criado_em: dataCriacao, atualizado_em: dataCriacao },
      ]);
      const app = await buildApp({ prisma, logger: false });

      const resposta = await app.inject({
        method: 'GET',
        url: '/usuarios/2/validar-garcom',
      });

      expect(resposta.statusCode).toBe(422);
      const corpo = resposta.json();
      expect(corpo.erro.codigo).toBe('GARCOM_INVALIDO');
      expect(corpo.erro.detalhes.motivo).toBe('PERFIL_INVALIDO');

      await app.close();
    });
  });

  describe('Interface ServicoUsuarios isolada (Desacoplamento)', () => {
    it('ServicoUsuariosPrisma lança erro interno amigável caso prisma.usuario não esteja configurado', async () => {
      const prismaSemUsuario: ClienteBanco = {
        $queryRaw: vi.fn(),
      };
      const servico = new ServicoUsuariosPrisma(prismaSemUsuario);

      await expect(servico.buscarPorId(1)).rejects.toThrow(
        'Repositório de usuários não configurado no cliente do banco.',
      );
    });
  });
});
