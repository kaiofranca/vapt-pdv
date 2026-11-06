import { describe, expect, it, vi } from 'vitest';
import { FakeKdsGateway, HttpKdsGateway } from '../src/shared/gateways/kds.gateway';
import { buildApp } from '../src/app';
import { ClienteBanco } from '../src/shared/prisma';
import { Prisma } from '@prisma/client';

describe('Story 2.1.5 — Core: Integração via KdsGateway com Resiliência e Timeout (ADR-01, ADR-07)', () => {
  it('EARS-KDSGW-01/02: FakeKdsGateway despacha ficha de preparo estruturada com sucesso', async () => {
    const gateway = new FakeKdsGateway();

    const resultado = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 25,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_garcom: 'Carlos',
      nome_produto: 'Hambúrguer Artesanal',
      setor: 'cozinha',
      quantidade: 2,
      observacao: 'Sem cebola',
    });

    expect(resultado.sucesso).toBe(true);
    expect(resultado.fichaId).toBe(1);
    expect(gateway.fichasDespachadas).toHaveLength(1);
    expect(gateway.fichasDespachadas[0].observacao).toBe('Sem cebola');
    expect(gateway.fichasDespachadas[0].mesa).toBe(7);
  });

  it('EARS-KDSGW-07: Resiliência contra timeout e conexão recusada (ADR-07)', async () => {
    const gateway = new FakeKdsGateway();
    gateway.simularTimeout = true;

    const resTimeout = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 26,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_produto: 'Pizza',
      quantidade: 1,
    });

    expect(resTimeout.sucesso).toBe(false);
    expect(resTimeout.erro).toContain('timeout');

    gateway.simularTimeout = false;
    gateway.simularErroConexao = true;

    const resConexao = await gateway.despacharFicha({
      comanda_id: 10,
      item_comanda_id: 27,
      produto_id: 3,
      mesa: 7,
      garcom_id: 1,
      nome_produto: 'Pizza',
      quantidade: 1,
    });

    expect(resConexao.sucesso).toBe(false);
    expect(resConexao.erro).toContain('ECONNREFUSED');
  });

  it('EARS-KDSGW-06: HttpKdsGateway respeita modo disabled via variável de ambiente', async () => {
    const originalEnv = process.env.KDS_SERVICE_URL;
    process.env.KDS_SERVICE_URL = 'disabled';

    const gateway = new HttpKdsGateway();
    const resultado = await gateway.despacharFicha({
      comanda_id: 1,
      item_comanda_id: 1,
      produto_id: 1,
      mesa: 1,
      garcom_id: 1,
      nome_produto: 'Água Mineral',
      quantidade: 1,
    });

    expect(resultado.sucesso).toBe(true);
    process.env.KDS_SERVICE_URL = originalEnv;
  });
});
