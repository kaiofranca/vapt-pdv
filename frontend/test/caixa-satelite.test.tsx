import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  caixaSatApi,
  CaixaSatError,
  formatarRecibo48Colunas,
  calcularDivisaoLocal,
  type DividirResposta,
  type PagarComandaResposta,
  type ReciboCompletoResposta,
} from '../src/features/caixa/api/caixaSatApi';
import { ModalSplitPayment } from '../src/features/caixa/components/ModalSplitPayment';
import { ModalPagamento } from '../src/features/caixa/components/ModalPagamento';
import { ReciboPaperView } from '../src/features/caixa/components/ReciboPaperView';
import { ComprovanteVenda } from '../src/features/caixa/components/ComprovanteVenda';
import type { Comanda } from '../src/types/api';

const mockComandaBase: Comanda = {
  id: 10,
  mesa: '05',
  garcom_id: 1,
  status: 'fechada',
  aberta_em: '2026-11-05T19:00:00Z',
  fechada_em: '2026-11-05T20:30:00Z',
  subtotal: '90.91',
  taxa_servico: '9.09',
  total: '100.00',
  itens: [
    {
      id: 1,
      comanda_id: 10,
      produto_id: 1,
      nome_copiado: 'Prato Executivo',
      preco_copiado: '45.45',
      quantidade: 2,
    },
  ],
};

function renderComQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Story 2.2.8 — Caixa Frontend: Reconexão ao Satélite caixa-service (:3002)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Cliente HTTP caixaSatApi (Contratos REST e Tipos)', () => {
    it('deve chamar POST :3002/caixa/comandas/:id/dividir com conservação de centavos', async () => {
      const mockRespostaSat: DividirResposta = {
        comanda_id: 10,
        mesa: 5,
        modo: 'pessoas',
        pessoas: 3,
        total_comanda: '100.00',
        saldo_a_dividir: '100.00',
        cotas: [
          { numero_cota: 1, rotulo: 'Pessoa 1', valor: '33.33', status: 'pendente' },
          { numero_cota: 2, rotulo: 'Pessoa 2', valor: '33.33', status: 'pendente' },
          { numero_cota: 3, rotulo: 'Pessoa 3', valor: '33.34', status: 'pendente' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRespostaSat,
      } as any);

      const resultado = await caixaSatApi.dividirComanda(10, {
        tipo: 'igualitaria',
        quantidade_pessoas: 3,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/caixa/comandas/10/dividir'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"pessoas":3'),
        }),
      );

      expect(resultado.cotas).toHaveLength(3);
      expect(resultado.cotas[0].valor).toBe('33.33');
      expect(resultado.cotas[1].valor).toBe('33.33');
      expect(resultado.cotas[2].valor).toBe('33.34');

      // Soma estrita conservando 100% dos centavos (RN19)
      const soma = resultado.cotas.reduce((acc, c) => acc + parseFloat(c.valor), 0);
      expect(soma.toFixed(2)).toBe('100.00');
    });

    it('deve chamar POST :3002/caixa/comandas/:id/pagar e retornar cálculo de troco', async () => {
      const mockRespostaPagar: PagarComandaResposta = {
        comanda_id: 10,
        mesa: 5,
        status: 'paga',
        aplicar_taxa_servico: true,
        subtotal: '90.91',
        taxa_servico: '9.09',
        total: '100.00',
        valor_pago: '100.00',
        saldo_restante: '0.00',
        troco_total: '16.66',
        parcela_registrada: {
          id: 1,
          numero_parcela: 1,
          pagador_rotulo: 'Conta Integral',
          forma_pagamento: 'dinheiro',
          valor_aplicado: '33.34',
          valor_recebido: '50.00',
          troco: '16.66',
          criado_em: '2026-11-05T20:35:00Z',
        },
        recibo: {
          id: 77,
          numero_recibo: 77,
          codigo_autenticacao: 'VAPT-20261105-M05-A1B2',
          emitido_em: '2026-11-05T20:35:01Z',
        },
        avisos: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRespostaPagar,
      } as any);

      const resultado = await caixaSatApi.pagarComanda(10, {
        forma_pagamento: 'dinheiro',
        valor_aplicado: '33.34',
        valor_recebido: '50.00',
        numero_cota: 1,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/caixa/comandas/10/pagar'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"valor_recebido":"50.00"'),
        }),
      );

      expect(resultado.parcela_registrada.troco).toBe('16.66');
      expect(resultado.troco_total).toBe('16.66');
      expect(resultado.status).toBe('paga');
    });

    it('deve chamar GET :3002/caixa/recibos/:id e obter texto térmico .paper de 48 colunas', async () => {
      const mockRecibo: ReciboCompletoResposta = {
        id: 77,
        numero_recibo: 77,
        comanda_id: 10,
        mesa: 5,
        garcom_nome: 'Carlos Garçom',
        operador_caixa: 'Ana Caixa',
        codigo_autenticacao: 'VAPT-20261105-M05-A1B2',
        subtotal: '90.91',
        taxa_servico: '9.09',
        total: '100.00',
        troco_total: '16.66',
        itens: [
          { nome: 'Prato Executivo', quantidade: 2, preco_unitario: '45.45', subtotal: '90.91' },
        ],
        pagamentos: [
          {
            id: 1,
            numero_parcela: 1,
            pagador_rotulo: 'Conta Integral',
            forma_pagamento: 'dinheiro',
            valor_aplicado: '100.00',
            valor_recebido: '116.66',
            troco: '16.66',
            criado_em: '2026-11-05T20:35:00Z',
          },
        ],
        emitido_em: '2026-11-05T20:35:01Z',
        paper_text:
          '================================================\n          VAPT PDV - BAR & RESTAURANTE          \n================================================\nMesa: 05                            Comanda: #10\n------------------------------------------------\nTOTAL A PAGAR:                          R$ 100.00\n------------------------------------------------\nCodigo de Autenticacao:   VAPT-20261105-M05-A1B2\n================================================',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRecibo,
      } as any);

      const resultado = await caixaSatApi.obterRecibo(10);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/caixa/recibos/10'),
        expect.objectContaining({ method: 'GET' }),
      );

      expect(resultado.paper_text).toContain('VAPT PDV - BAR & RESTAURANTE');
      expect(resultado.codigo_autenticacao).toBe('VAPT-20261105-M05-A1B2');
    });
  });

  describe('2. ModalSplitPayment com Validação pelo Satélite :3002 (RN19, AC-CXSAT-02)', () => {
    it('deve disparar divisão pelo satélite ao confirmar divisão e renderizar cotas com conservação de centavos', async () => {
      const spyDividir = vi.spyOn(caixaSatApi, 'dividirComanda').mockResolvedValueOnce({
        comanda_id: 10,
        mesa: 5,
        modo: 'pessoas',
        pessoas: 3,
        total_comanda: '100.00',
        saldo_a_dividir: '100.00',
        cotas: [
          { numero_cota: 1, rotulo: 'Pessoa 1', valor: '33.33', status: 'pendente' },
          { numero_cota: 2, rotulo: 'Pessoa 2', valor: '33.33', status: 'pendente' },
          { numero_cota: 3, rotulo: 'Pessoa 3', valor: '33.34', status: 'pendente' },
        ],
      });

      const onAplicarCota = vi.fn();
      const onClose = vi.fn();

      render(
        <ModalSplitPayment
          isOpen={true}
          onClose={onClose}
          comanda={mockComandaBase}
          onAplicarCota={onAplicarCota}
        />,
      );

      // Incrementa para 3 pessoas
      const btnMais = screen.getByLabelText(/Aumentar pessoas/i);
      fireEvent.click(btnMais);

      // Clica em Confirmar Divisão para acionar satélite :3002
      const btnConfirmar = screen.getByTestId('btn-confirmar-divisao');
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyDividir).toHaveBeenCalledWith(10, {
          tipo: 'igualitaria',
          quantidade_pessoas: 3,
        });
      });

      // Valida que as cotas retornadas pelo satélite foram renderizadas
      const cota1 = screen.getByTestId('cota-pessoa-1');
      const cota2 = screen.getByTestId('cota-pessoa-2');
      const cota3 = screen.getByTestId('cota-pessoa-3');

      expect(cota1.textContent).toMatch(/33,33/);
      expect(cota2.textContent).toMatch(/33,33/);
      expect(cota3.textContent).toMatch(/33,34/);

      // Clica para cobrar a terceira cota (R$ 33,34)
      const botoesCobrar = screen.getAllByRole('button', { name: /Cobrar Esta Cota/i });
      fireEvent.click(botoesCobrar[2]);

      expect(onAplicarCota).toHaveBeenCalledWith(3334, expect.stringContaining('Pessoa 3'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('3. ModalPagamento com Liquidação e Cálculo de Troco Oficial (AC-CXSAT-01, EARS-CXSAT-08)', () => {
    it('deve chamar pagarComanda no satélite em pagamento em dinheiro e exibir troco oficial', async () => {
      const spyPagar = vi.spyOn(caixaSatApi, 'pagarComanda').mockResolvedValueOnce({
        comanda_id: 10,
        mesa: 5,
        status: 'paga',
        aplicar_taxa_servico: true,
        subtotal: '90.91',
        taxa_servico: '9.09',
        total: '100.00',
        valor_pago: '100.00',
        saldo_restante: '0.00',
        troco_total: '20.00',
        parcela_registrada: {
          id: 1,
          numero_parcela: 1,
          pagador_rotulo: 'Conta Integral',
          forma_pagamento: 'dinheiro',
          valor_aplicado: '100.00',
          valor_recebido: '120.00',
          troco: '20.00',
          criado_em: '2026-11-05T20:30:00Z',
        },
        recibo: {
          id: 99,
          numero_recibo: 99,
          codigo_autenticacao: 'VAPT-20261105-M05-98F2',
          emitido_em: '2026-11-05T20:30:01Z',
        },
        avisos: [],
      });

      const spyRecibo = vi.spyOn(caixaSatApi, 'obterRecibo').mockResolvedValueOnce({
        id: 99,
        numero_recibo: 99,
        comanda_id: 10,
        mesa: 5,
        garcom_nome: 'Carlos Garçom',
        codigo_autenticacao: 'VAPT-20261105-M05-98F2',
        subtotal: '90.91',
        taxa_servico: '9.09',
        total: '100.00',
        troco_total: '20.00',
        itens: [],
        pagamentos: [],
        emitido_em: '2026-11-05T20:30:01Z',
        paper_text: 'VAPT PDV\nTROCO OFICIAL: R$ 20.00\nVAPT-20261105-M05-98F2',
      });

      const onPagamentoConcluido = vi.fn();
      const onToast = vi.fn();

      renderComQuery(
        <ModalPagamento
          isOpen={true}
          onClose={vi.fn()}
          comanda={mockComandaBase}
          onPagamentoConcluido={onPagamentoConcluido}
          onToast={onToast}
          nomeOperador="Operador 01"
        />,
      );

      // Clica na cédula rápida ou digita valor recebido de R$ 120,00
      const btnValor100 = screen.getByText('R$ 100');
      fireEvent.click(btnValor100);

      // Clica em Confirmar Pagamento em Dinheiro
      const btnConfirmarDinheiro = screen.getByRole('button', {
        name: /Confirmar Pagamento em Dinheiro/i,
      });
      fireEvent.click(btnConfirmarDinheiro);

      await waitFor(() => {
        expect(spyPagar).toHaveBeenCalledWith(10, {
          forma_pagamento: 'dinheiro',
          valor_aplicado: '100.00',
          valor_recebido: '100.00',
          numero_cota: 1,
          operador_nome: 'Operador 01',
        });
      });

      await waitFor(() => {
        expect(onToast).toHaveBeenCalledWith(
          'sucesso',
          expect.stringContaining('Troco: R$ 20.00'),
        );
      });

      expect(onPagamentoConcluido).toHaveBeenCalled();
      expect(spyRecibo).toHaveBeenCalledWith(10);
    });
  });

  describe('4. ReciboPaperView e ComprovanteVenda (.paper de 48 colunas — C12, RN24)', () => {
    it('deve renderizar o texto oficial retornado por obterRecibo dentro do elemento monospace', () => {
      const mockTextoCanonica = formatarRecibo48Colunas({
        comanda_id: 10,
        mesa: 5,
        garcom_nome: 'Carlos Garçom',
        operador_caixa: 'Operador 01',
        codigo_autenticacao: 'VAPT-20261105-M05-ABCD',
        subtotal: '90.91',
        taxa_servico: '9.09',
        total: '100.00',
        troco_total: '10.00',
        itens: [{ nome: 'Prato Executivo', quantidade: 2, subtotal: '90.91' }],
        pagamentos: [{ forma_pagamento: 'dinheiro', valor_aplicado: '100.00', troco: '10.00' }],
      });

      render(
        <ReciboPaperView
          comanda={{ ...mockComandaBase, status: 'paga' }}
          paperText={mockTextoCanonica}
          codigoAutenticacao="VAPT-20261105-M05-ABCD"
        />,
      );

      const elementoPre = screen.getByTestId('recibo-paper-text');
      expect(elementoPre).toBeDefined();
      expect(elementoPre.textContent).toContain('VAPT PDV - BAR & RESTAURANTE');
      expect(elementoPre.textContent).toContain('Mesa: 5');
      expect(elementoPre.textContent).toContain('R$ 100.00');

      // Verifica se cada linha não excede 48 colunas
      const linhas = elementoPre.textContent?.split('\n') || [];
      linhas.forEach((linha) => {
        expect(linha.length).toBeLessThanOrEqual(48);
      });

      // Código de autenticação destacado
      const codigoAuth = screen.getByTestId('codigo-autenticacao-recibo');
      expect(codigoAuth.textContent).toBe('VAPT-20261105-M05-ABCD');
    });

    it('ComprovanteVenda deve renderizar mensagem de sucesso e bobina térmica .paper', () => {
      render(
        <ComprovanteVenda
          comanda={{ ...mockComandaBase, status: 'paga' }}
          parcelas={[]}
          paperText="VAPT PDV CANONICO 48 COLUNAS"
          onNovaVenda={vi.fn()}
        />,
      );

      expect(screen.getByText(/Venda Concluída!/i)).toBeDefined();
      expect(screen.getByTestId('recibo-paper-text').textContent).toContain(
        'VAPT PDV CANONICO 48 COLUNAS',
      );
    });
  });

  describe('5. Degradação Graciosa e Resiliência em Falhas do Satélite (ADR-07, EARS-CXSAT-10, AC-CXSAT-04)', () => {
    it('deve exibir alerta amigável e usar cálculo local se satélite responder 503 na divisão', async () => {
      vi.spyOn(caixaSatApi, 'dividirComanda').mockRejectedValueOnce(
        new CaixaSatError(503, 'SERVICO_INDISPONIVEL', 'O serviço satélite está indisponível.'),
      );

      render(
        <ModalSplitPayment
          isOpen={true}
          onClose={vi.fn()}
          comanda={mockComandaBase}
          onAplicarCota={vi.fn()}
        />,
      );

      const btnConfirmar = screen.getByTestId('btn-confirmar-divisao');
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByRole('alert').textContent).toContain('indisponível');
      });

      // Valida que fallback com conservação de centavos continua funcionando na tela
      const cota1 = screen.getByTestId('cota-pessoa-1');
      expect(cota1).toBeDefined();
      expect(cota1.textContent).toMatch(/50,00/);
    });

    it('deve preservar dados digitados no ModalPagamento se satélite responder erro 503', async () => {
      vi.spyOn(caixaSatApi, 'pagarComanda').mockRejectedValueOnce(
        new CaixaSatError(503, 'SERVICO_INDISPONIVEL', 'caixa-service (:3002) inacessível.'),
      );

      const onToast = vi.fn();

      renderComQuery(
        <ModalPagamento
          isOpen={true}
          onClose={vi.fn()}
          comanda={mockComandaBase}
          onPagamentoConcluido={vi.fn()}
          onToast={onToast}
        />,
      );

      // Clica para confirmar pagamento em dinheiro
      const btnConfirmarDinheiro = screen.getByRole('button', {
        name: /Confirmar Pagamento em Dinheiro/i,
      });
      fireEvent.click(btnConfirmarDinheiro);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByRole('alert').textContent).toContain('caixa-service (:3002) inacessível');
      });

      // EARS-CXSAT-10: Garante que o operador não perdeu os dados e botão continuar visível
      expect(onToast).toHaveBeenCalledWith('erro', expect.stringContaining('inacessível'));
      expect(screen.getByRole('button', { name: /Confirmar Pagamento em Dinheiro/i })).toBeDefined();
    });

    it('calcularDivisaoLocal deve dividir valores ímpares conservando 100% dos centavos', () => {
      // Divide R$ 100,00 entre 3 pessoas
      const cotas = calcularDivisaoLocal('100.00', 3);
      expect(cotas).toHaveLength(3);
      expect(cotas[0].valor).toBe('33.33');
      expect(cotas[1].valor).toBe('33.33');
      expect(cotas[2].valor).toBe('33.34');

      const somaCentavos = cotas.reduce((acc, c) => acc + Math.round(parseFloat(c.valor) * 100), 0);
      expect(somaCentavos).toBe(10000);
    });
  });
});
