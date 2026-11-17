import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';

const RAIZ_REPO = path.resolve(__dirname, '..', '..');

function criarPrismaMock(): ClienteBanco {
  return {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $disconnect: vi.fn(async () => undefined),
  };
}

describe('Epic 3 — Proxy reverso de Gestão/Analytics no vapt-pdv-core', () => {
  const fetchOriginal = globalThis.fetch;
  const gestaoServiceUrlOriginal = process.env.GESTAO_SERVICE_URL;
  const gestaoApiUrlOriginal = process.env.GESTAO_API_URL;

  beforeEach(() => {
    delete process.env.GESTAO_SERVICE_URL;
    delete process.env.GESTAO_API_URL;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    if (gestaoServiceUrlOriginal === undefined) {
      delete process.env.GESTAO_SERVICE_URL;
    } else {
      process.env.GESTAO_SERVICE_URL = gestaoServiceUrlOriginal;
    }
    if (gestaoApiUrlOriginal === undefined) {
      delete process.env.GESTAO_API_URL;
    } else {
      process.env.GESTAO_API_URL = gestaoApiUrlOriginal;
    }
    vi.restoreAllMocks();
  });

  it('mantém GET /gestao (rota exata da SPA) retornando HTML sem encaminhar ao satélite', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/gestao',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toMatch(/text\/html/);
    expect(resposta.body).toContain('<div id="root"></div>');
    expect(fetchMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('encaminha GET /gestao/resumo-diario com query string para GESTAO_SERVICE_URL', async () => {
    process.env.GESTAO_SERVICE_URL = 'http://gestao-service:3003/';
    const payloadUpstream = {
      data: '2026-11-13',
      faturamento_total: '1250.50',
      comandas_pagas: 12,
    };

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(payloadUpstream), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/gestao/resumo-diario?data=2026-11-13',
      headers: {
        accept: 'application/json',
      },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toContain('application/json');
    expect(resposta.json()).toEqual(payloadUpstream);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlChamada, opcoesChamada] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(urlChamada).toBe('http://gestao-service:3003/gestao/resumo-diario?data=2026-11-13');
    expect(opcoesChamada.method).toBe('GET');
    expect((opcoesChamada.headers as Record<string, string>).accept).toBe('application/json');
    expect(opcoesChamada.signal).toBeInstanceOf(AbortSignal);

    await app.close();
  });

  it('preserva Content-Type e Content-Disposition em exportação CSV via /gestao/exportar', async () => {
    process.env.GESTAO_API_URL = 'http://127.0.0.1:3003';
    const csv = 'data,total\n2026-11-13,500.00\n';

    const fetchMock = vi.fn(async () => {
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="relatorio-faturamento.csv"',
        },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/gestao/exportar?tipo=faturamento&formato=csv',
      headers: {
        accept: 'text/csv',
      },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/csv');
    expect(resposta.headers['content-disposition']).toBe(
      'attachment; filename="relatorio-faturamento.csv"',
    );
    expect(resposta.body).toBe(csv);

    const [urlChamada] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(urlChamada).toBe(
      'http://127.0.0.1:3003/gestao/exportar?tipo=faturamento&formato=csv',
    );

    await app.close();
  });

  it('encaminha POST /analytics/eventos com método, corpo e headers para fallback localhost:3003', async () => {
    const evento = {
      evento_id: 'evt-123',
      tipo: 'comanda.paga',
      dados: { comanda_id: 42, total: '89.90' },
    };

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ recebido: true, duplicado: false }), {
        status: 202,
        headers: {
          'content-type': 'application/json',
        },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });
    const resposta = await app.inject({
      method: 'POST',
      url: '/analytics/eventos',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: evento,
    });

    expect(resposta.statusCode).toBe(202);
    expect(resposta.json()).toEqual({ recebido: true, duplicado: false });

    const [urlChamada, opcoesChamada] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(urlChamada).toBe('http://localhost:3003/analytics/eventos');
    expect(opcoesChamada.method).toBe('POST');
    expect((opcoesChamada.headers as Record<string, string>)['content-type']).toContain(
      'application/json',
    );
    expect(JSON.parse(String(opcoesChamada.body))).toEqual(evento);

    await app.close();
  });

  it('retorna 503 SERVICO_INDISPONIVEL padronizado quando o gestao-service falha ou expira timeout', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:3003');
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = await buildApp({ prisma: criarPrismaMock(), logger: false });
    const resposta = await app.inject({
      method: 'GET',
      url: '/gestao/ranking-produtos',
    });

    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({
      erro: {
        codigo: 'SERVICO_INDISPONIVEL',
        mensagem: 'O serviço "gestao-service" está temporariamente indisponível.',
        detalhes: {
          servico: 'gestao',
        },
      },
    });

    await app.close();
  });
});

describe('Epic 3 — Artefatos Docker, .dockerignore, Compose e Persistência', () => {
  it('backend/Dockerfile implementa build multi-stage enxuto, não-root, PWA e healthcheck', () => {
    const caminho = path.join(RAIZ_REPO, 'backend', 'Dockerfile');
    expect(fs.existsSync(caminho)).toBe(true);

    const conteudo = fs.readFileSync(caminho, 'utf8');
    expect(conteudo).toMatch(/FROM\s+node:20-alpine\s+AS\s+frontend-builder/i);
    expect(conteudo).toMatch(/FROM\s+node:20-alpine\s+AS\s+backend-builder/i);
    expect(conteudo).toMatch(/FROM\s+node:20-alpine\s+AS\s+runner/i);
    expect(conteudo).toContain('npx prisma generate');
    expect(conteudo).toContain('npm prune --omit=dev');
    expect(conteudo).toMatch(/npm install --no-save(?: --omit=dev)? prisma@\^6\.4\.1/);
    expect(conteudo).toContain('/usr/local/bin/npx');
    expect(conteudo).toContain('--chown=node:node');
    expect(conteudo).toContain('./public');
    expect(conteudo).toMatch(/^\s*USER\s+node\s*$/m);
    expect(conteudo).toMatch(/^\s*EXPOSE\s+3000\s*$/m);
    expect(conteudo).toContain('HEALTHCHECK');
    expect(conteudo).toContain('http://127.0.0.1:3000/health');
    expect(conteudo).toContain('npx prisma migrate deploy');
    expect(conteudo).toContain('node dist/server.js');
  });

  it('.dockerignore (raiz e backend/) excluem node_modules, dist, testes, docs e .env reais mantendo .env.example', () => {
    for (const caminho of [
      path.join(RAIZ_REPO, '.dockerignore'),
      path.join(RAIZ_REPO, 'backend', '.dockerignore'),
    ]) {
      expect(fs.existsSync(caminho)).toBe(true);
      const conteudo = fs.readFileSync(caminho, 'utf8');
      for (const padrao of [
        '**/node_modules',
        '**/dist',
        '.git',
        '_bmad',
        '_bmad-output',
        'docs',
        '**/.env',
        '**/.env.*',
        '!**/.env.example',
        '**/*.test.ts',
        '**/*.test.tsx',
      ]) {
        expect(conteudo).toContain(padrao);
      }
    }
  });

  it('services/*/Dockerfile implementam multi-stage node:20-alpine, USER node, HEALTHCHECK e migrate deploy', () => {
    const servicos = [
      { nome: 'kds-service', porta: 3001 },
      { nome: 'caixa-service', porta: 3002 },
      { nome: 'gestao-service', porta: 3003 },
    ];

    for (const servico of servicos) {
      const caminho = path.join(RAIZ_REPO, 'services', servico.nome, 'Dockerfile');
      expect(fs.existsSync(caminho)).toBe(true);
      const conteudo = fs.readFileSync(caminho, 'utf8');
      expect(conteudo).toMatch(/FROM\s+node:20-alpine\s+AS\s+builder/i);
      expect(conteudo).toMatch(/FROM\s+node:20-alpine\s+AS\s+runner/i);
      expect(conteudo).toMatch(/^\s*USER\s+node\s*$/m);
      expect(conteudo).toContain(`EXPOSE ${servico.porta}`);
      expect(conteudo).toContain(`http://127.0.0.1:${servico.porta}/health`);
      expect(conteudo).toContain('npx prisma migrate deploy');
      expect(conteudo).toContain('node dist/server.js');
    }
  });

  it('.env.docker.example define as variáveis de exemplo sem credenciais reais de produção', () => {
    const caminho = path.join(RAIZ_REPO, '.env.docker.example');
    expect(fs.existsSync(caminho)).toBe(true);
    const conteudo = fs.readFileSync(caminho, 'utf8');

    for (const chave of [
      'POSTGRES_USER=',
      'POSTGRES_PASSWORD=',
      'POSTGRES_DB_CORE=',
      'POSTGRES_DB_KDS=',
      'POSTGRES_DB_CAIXA=',
      'POSTGRES_DB_GESTAO=',
      'CORE_PORT=',
      'KDS_PORT=',
      'CAIXA_PORT=',
      'GESTAO_PORT=',
    ]) {
      expect(conteudo).toContain(chave);
    }
  });

  it('docker-compose.yml orquestra vaptpdv-net, 4 bancos isolados com volumes e os 4 serviços com healthchecks', () => {
    const caminho = path.join(RAIZ_REPO, 'docker-compose.yml');
    expect(fs.existsSync(caminho)).toBe(true);
    const conteudo = fs.readFileSync(caminho, 'utf8');

    expect(conteudo).toContain('vaptpdv-net');
    for (const volume of ['pgdata_core', 'pgdata_kds', 'pgdata_caixa', 'pgdata_gestao']) {
      expect(conteudo).toContain(volume);
    }
    for (const servico of [
      'postgres-core',
      'postgres-kds',
      'postgres-caixa',
      'postgres-gestao',
      'vapt-pdv-core',
      'kds-service',
      'caixa-service',
      'gestao-service',
    ]) {
      expect(conteudo).toContain(`${servico}:`);
    }
    expect(conteudo).toContain('service_healthy');
    expect(conteudo).toContain('pg_isready');
  });
});
