import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { StatusComandaTipo } from '../src/modules/comandas';
import { CaixaGateway, ICaixaGateway } from '../src/shared/gateways/caixa.gateway';

interface UsuarioSimulado {
  id: number;
  nome: string;
  perfil: 'garcom' | 'caixa' | 'gerente';
  ativo: boolean;
  criado_em: Date;
  atualizado_em: Date;
}

interface ItemComandaSimulado {
  id: number;
  comanda_id: number;
  produto_id: number;
  nome_copiado: string;
  preco_copiado: Prisma.Decimal;
  quantidade: number;
}

interface ComandaSimulada {
  id: number;
  mesa: string;
  nome_cliente: string | null;
  garcom_id: number;
  status: StatusComandaTipo;
  subtotal: Prisma.Decimal | null;
  taxa_servico: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  forma_pagamento: string | null;
  aberta_em: Date;
  fechada_em: Date | null;
  paga_em: Date | null;
  itens?: ItemComandaSimulado[];
}

function criarPrismaComComandasMock(opcoes: {
  usuariosIniciais?: UsuarioSimulado[];
  comandasIniciais?: ComandaSimulada[];
} = {}) {
  const usuarios = (opcoes.usuariosIniciais ?? []).map((u) => ({ ...u }));
  const comandas = (opcoes.comandasIniciais ?? []).map((c) => ({
    ...c,
    itens: (c.itens ?? []).map((i) => ({ ...i })),
  }));

  const usuarioMock = {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const encontrado = usuarios.find((u) => u.id === where.id);
      return encontrado ? { ...encontrado } : null;
    }),
  };

  const produtoMock = {
    findUnique: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  };

  const movimentoEstoqueMock = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
  };

  const itemComandaMock = {
    create: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  };

  const comandaMock = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    findMany: vi.fn(async () => comandas.map((c) => ({ ...c }))),
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { id: number };
        include?: { itens?: boolean | { orderBy?: { id?: 'asc' | 'desc' } } };
      }) => {
        const encontrada = comandas.find((c) => c.id === where.id);
        if (!encontrada) return null;
        return {
          ...encontrada,
          itens: include?.itens ? (encontrada.itens ?? []).map((i) => ({ ...i })) : undefined,
        };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
        include,
      }: {
        where: { id: number };
        data: Partial<ComandaSimulada>;
        include?: { itens?: boolean | { orderBy?: { id?: 'asc' | 'desc' } } };
      }) => {
        const index = comandas.findIndex((c) => c.id === where.id);
        if (index === -1) throw new Error('Comanda not found');
        comandas[index] = { ...comandas[index], ...data };
        return {
          ...comandas[index],
          itens: include?.itens ? (comandas[index].itens ?? []).map((i) => ({ ...i })) : undefined,
        };
      },
    ),
  };

  const prisma: ClienteBanco = {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
    $transaction: vi.fn(async (operacao: any) => operacao(prisma)),
    usuario: usuarioMock as any,
    produto: produtoMock as any,
    movimentoEstoque: movimentoEstoqueMock as any,
    comanda: comandaMock as any,
    itemComanda: itemComandaMock as any,
  };

  return { prisma, comandas, comandaMock };
}

describe('Integração com CaixaGateway e Resiliência (Story 15.6 - ADR-07, RN17)', () => {
  const garcomPadrao: UsuarioSimulado = {
    id: 1,
    nome: 'Carlos Garçom',
    perfil: 'garcom',
    ativo: true,
    criado_em: new Date('2026-10-20T10:00:00Z'),
    atualizado_em: new Date('2026-10-20T10:00:00Z'),
  };

  const comandaAbertaComItens: ComandaSimulada = {
    id: 1,
    mesa: '12',
    nome_cliente: 'Cliente Teste',
    garcom_id: 1,
    status: 'aberta',
    subtotal: null,
    taxa_servico: null,
    total: null,
    forma_pagamento: null,
    aberta_em: new Date('2026-10-20T11:00:00Z'),
    fechada_em: null,
    paga_em: null,
    itens: [
      {
        id: 501,
        comanda_id: 1,
        produto_id: 10,
        nome_copiado: 'Cerveja IPA',
        preco_copiado: new Prisma.Decimal('14.90'),
        quantidade: 2,
      },
    ],
  };

  describe('Classe CaixaGateway (Cliente HTTP)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Envia notificação com sucesso quando o caixa-service responde 200 OK', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'recebido', conta_id: 'c-101' }),
      } as any);

      const gateway = new CaixaGateway('http://localhost:3002');
      const resultado = await gateway.notificarFechamento(1, { total: '29.80' });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3002/caixa/comandas/1/fechar',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ total: '29.80' }),
        }),
      );

      expect(resultado).toEqual({
        sucesso: true,
        statusCode: 200,
        dados: { status: 'recebido', conta_id: 'c-101' },
      });
    });

    it('Retorna sucesso: false quando o caixa-service responde com erro HTTP (500)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any);

      const gateway = new CaixaGateway('http://localhost:3002');
      const resultado = await gateway.notificarFechamento(1, { total: '29.80' });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.statusCode).toBe(500);
      expect(resultado.erro).toContain('500');
    });

    it('Retorna sucesso: false com descrição do erro quando ocorre falha de conexão (offline)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:3002'),
      );

      const gateway = new CaixaGateway('http://localhost:3002');
      const resultado = await gateway.notificarFechamento(1, { total: '29.80' });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toContain('ECONNREFUSED');
    });

    it('Retorna sucesso: false quando ocorre timeout da requisição (>2000ms)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('The operation was aborted due to timeout'),
      );

      const gateway = new CaixaGateway('http://localhost:3002');
      const resultado = await gateway.notificarFechamento(1, { total: '29.80' });

      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toMatch(/timeout|aborted/i);
    });
  });

  describe('Integração em POST /comandas/:id/fechar com CaixaGateway', () => {
    it('Caso Online: notifica caixa-service com sucesso (200), comanda fechada e integracao_caixa_pendente false', async () => {
      const { prisma, comandas } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        comandasIniciais: [comandaAbertaComItens],
      });

      const caixaGatewayMock: ICaixaGateway = {
        notificarFechamento: vi.fn(async () => ({
          sucesso: true,
          statusCode: 200,
          dados: { status: 'conta_criada' },
        })),
      };

      const app = await buildApp({
        prisma,
        caixaGateway: caixaGatewayMock,
        logger: false,
      });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: true },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();

      // Comanda devidamente fechada no Core
      expect(corpo.id).toBe(1);
      expect(corpo.status).toBe('fechada');
      expect(corpo.subtotal).toBe('29.80');
      expect(corpo.taxa_servico).toBe('2.98');
      expect(corpo.total).toBe('32.78');
      expect(corpo.integracao_caixa_pendente).toBe(false);
      expect(corpo.avisos).toBeUndefined();

      // Estado persistido no banco local
      expect(comandas[0].status).toBe('fechada');
      expect(comandas[0].total?.toFixed(2)).toBe('32.78');

      // CaixaGateway chamado com payload completo e snapshot dos itens
      expect(caixaGatewayMock.notificarFechamento).toHaveBeenCalledTimes(1);
      expect(caixaGatewayMock.notificarFechamento).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          mesa: 12,
          garcom_id: 1,
          nome_cliente: 'Cliente Teste',
          aplicar_taxa_servico: true,
          subtotal: '29.80',
          taxa_servico: '2.98',
          total: '32.78',
          itens: [
            {
              item_comanda_id: 501,
              produto_id: 10,
              nome: 'Cerveja IPA',
              preco_unitario: '14.90',
              quantidade: 2,
            },
          ],
        }),
      );

      await app.close();
    });

    it('Caso Offline: degradação graciosa (ADR-07, RN17) — banco local fecha a comanda, retorna 200 com integracao_caixa_pendente true', async () => {
      const { prisma, comandas } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        comandasIniciais: [comandaAbertaComItens],
      });

      const caixaGatewayMock: ICaixaGateway = {
        notificarFechamento: vi.fn(async () => ({
          sucesso: false,
          erro: 'connect ECONNREFUSED 127.0.0.1:3002',
        })),
      };

      const app = await buildApp({
        prisma,
        caixaGateway: caixaGatewayMock,
        logger: false,
      });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: false },
      });

      // Retorna 200 OK (não reverte nem falha a transação do salão)
      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();

      expect(corpo.id).toBe(1);
      expect(corpo.status).toBe('fechada');
      expect(corpo.subtotal).toBe('29.80');
      expect(corpo.taxa_servico).toBe('0.00');
      expect(corpo.total).toBe('29.80');

      // Degradação graciosa sinalizada na resposta
      expect(corpo.integracao_caixa_pendente).toBe(true);
      expect(corpo.avisos).toEqual(['integracao_caixa_pendente: true']);

      // Comanda permaneceu persistida como fechada no banco local
      expect(comandas[0].status).toBe('fechada');
      expect(comandas[0].total?.toFixed(2)).toBe('29.80');

      await app.close();
    });

    it('Caso Timeout: degradação graciosa com integracao_caixa_pendente true quando chamada ao caixa-service expira', async () => {
      const { prisma, comandas } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        comandasIniciais: [comandaAbertaComItens],
      });

      const caixaGatewayMock: ICaixaGateway = {
        notificarFechamento: vi.fn(async () => ({
          sucesso: false,
          erro: 'The operation was aborted due to timeout',
        })),
      };

      const app = await buildApp({
        prisma,
        caixaGateway: caixaGatewayMock,
        logger: false,
      });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: true },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();

      expect(corpo.status).toBe('fechada');
      expect(corpo.integracao_caixa_pendente).toBe(true);
      expect(corpo.avisos).toEqual(['integracao_caixa_pendente: true']);
      expect(comandas[0].status).toBe('fechada');

      await app.close();
    });

    it('Degradação graciosa mesmo se gateway lançar exceção não capturada internamente', async () => {
      const { prisma, comandas } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        comandasIniciais: [comandaAbertaComItens],
      });

      const caixaGatewayMock: ICaixaGateway = {
        notificarFechamento: vi.fn(async () => {
          throw new Error('Falha de rede fatal no gateway');
        }),
      };

      const app = await buildApp({
        prisma,
        caixaGateway: caixaGatewayMock,
        logger: false,
      });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: true },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();

      expect(corpo.status).toBe('fechada');
      expect(corpo.integracao_caixa_pendente).toBe(true);
      expect(corpo.avisos).toEqual(['integracao_caixa_pendente: true']);
      expect(comandas[0].status).toBe('fechada');

      await app.close();
    });

    it('Comportamento real com porta fechada usando instância nativa do CaixaGateway', async () => {
      const { prisma, comandas } = criarPrismaComComandasMock({
        usuariosIniciais: [garcomPadrao],
        comandasIniciais: [comandaAbertaComItens],
      });

      // Instância nativa apontando para uma porta inacessível (ex: 39999)
      const realGateway = new CaixaGateway('http://127.0.0.1:39999');

      const app = await buildApp({
        prisma,
        caixaGateway: realGateway,
        logger: false,
      });

      const resposta = await app.inject({
        method: 'POST',
        url: '/comandas/1/fechar',
        payload: { aplicar_taxa_servico: true },
      });

      expect(resposta.statusCode).toBe(200);
      const corpo = resposta.json();

      expect(corpo.status).toBe('fechada');
      expect(corpo.integracao_caixa_pendente).toBe(true);
      expect(corpo.avisos).toEqual(['integracao_caixa_pendente: true']);
      expect(comandas[0].status).toBe('fechada');

      await app.close();
    });
  });
});
