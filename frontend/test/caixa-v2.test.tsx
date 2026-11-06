import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ModoDinheiroTeclado } from '../src/features/caixa/components/ModoDinheiroTeclado';
import { ModalSplitPayment } from '../src/features/caixa/components/ModalSplitPayment';
import { ReciboPaperView, gerarCodigoAutenticacao } from '../src/features/caixa/components/ReciboPaperView';
import { ModalCancelarComanda, FRASE_CANCELAMENTO } from '../src/features/caixa/components/ModalCancelarComanda';
import type { Comanda } from '../src/types/api';

const mockComandaBase: Comanda = {
  id: 42,
  mesa: '04',
  garcom_id: 1,
  status: 'aberta',
  aberta_em: '2026-11-04T20:00:00Z',
  subtotal: '100.00',
  taxa_servico: '10.00',
  total: '110.00',
  itens: [
    {
      id: 101,
      comanda_id: 42,
      produto_id: 1,
      quantidade: 2,
      nome_copiado: 'Hambúrguer Artesanal',
      preco_copiado: '35.00',
      criado_em: '2026-11-04T20:05:00Z',
    },
    {
      id: 102,
      comanda_id: 42,
      produto_id: 2,
      quantidade: 3,
      nome_copiado: 'Refrigerante Lata',
      preco_copiado: '10.00',
      criado_em: '2026-11-04T20:06:00Z',
    },
  ],
};

describe('Story 15.7 - Modo Caixa v2 Componentes', () => {
  describe('1. ModoDinheiroTeclado (C07 Dinheiro com Troco e Teclado Touch)', () => {
    it('deve renderizar teclado numérico completo, cédulas rápidas e barra de progresso', () => {
      const onValorChange = vi.fn();
      const onConfirmar = vi.fn();

      render(
        <ModoDinheiroTeclado
          totalCentavos={11000}
          jaPagoCentavos={0}
          valorParcelaCentavos={11000}
          valorRecebidoInput=""
          onValorRecebidoChange={onValorChange}
          onConfirmar={onConfirmar}
        />
      );

      // Barra de progresso e textos
      expect(screen.getByText(/Já pago: R\$\s*0,00/i)).toBeDefined();
      expect(screen.getByText(/Falta: R\$\s*110,00/i)).toBeDefined();

      // Teclas numéricas 0 a 9 e botões rápidos
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByText(String(i))).toBeDefined();
      }
      expect(screen.getByText('R$ 20')).toBeDefined();
      expect(screen.getByText('R$ 50')).toBeDefined();
      expect(screen.getByText('R$ 100')).toBeDefined();
      expect(screen.getByText('Valor Exato')).toBeDefined();
      expect(screen.getByText('C')).toBeDefined();
    });

    it('deve chamar onValorRecebidoChange ao tocar nos botões de cédula rápida e valor exato', () => {
      const onValorChange = vi.fn();
      const onConfirmar = vi.fn();

      render(
        <ModoDinheiroTeclado
          totalCentavos={11000}
          jaPagoCentavos={0}
          valorParcelaCentavos={11000}
          valorRecebidoInput="0"
          onValorRecebidoChange={onValorChange}
          onConfirmar={onConfirmar}
        />
      );

      fireEvent.click(screen.getByText('R$ 50'));
      expect(onValorChange).toHaveBeenCalledWith('50,00');

      fireEvent.click(screen.getByText('R$ 100'));
      expect(onValorChange).toHaveBeenCalledWith('100,00');

      fireEvent.click(screen.getByText('Valor Exato'));
      expect(onValorChange).toHaveBeenCalledWith('110,00');
    });

    it('deve calcular e destacar visualmente o troco instantâneo com valor entregue maior que a parcela', () => {
      const onValorChange = vi.fn();
      const onConfirmar = vi.fn();

      const { rerender } = render(
        <ModoDinheiroTeclado
          totalCentavos={11000}
          jaPagoCentavos={0}
          valorParcelaCentavos={11000}
          valorRecebidoInput="150,00"
          onValorRecebidoChange={onValorChange}
          onConfirmar={onConfirmar}
        />
      );

      // Troco = 150,00 - 110,00 = 40,00
      expect(screen.getByText(/Troco a Devolver/i)).toBeDefined();
      const trocoElement = screen.getByTestId('valor-troco');
      expect(trocoElement.textContent).toMatch(/40,00/);

      // Botão habilitado para confirmação
      const botaoConfirmar = screen.getByRole('button', {
        name: /Confirmar Pagamento em Dinheiro/i,
      });
      expect(botaoConfirmar.hasAttribute('disabled')).toBe(false);
      fireEvent.click(botaoConfirmar);
      expect(onConfirmar).toHaveBeenCalledTimes(1);

      // Re-render com valor insuficiente
      rerender(
        <ModoDinheiroTeclado
          totalCentavos={11000}
          jaPagoCentavos={0}
          valorParcelaCentavos={11000}
          valorRecebidoInput="90,00"
          onValorRecebidoChange={onValorChange}
          onConfirmar={onConfirmar}
        />
      );

      expect(screen.getByText(/Valor Insuficiente/i)).toBeDefined();
      expect(botaoConfirmar.hasAttribute('disabled')).toBe(true);
    });

    it('deve manipular digitação pelo teclado touch (dígitos, backspace e C)', () => {
      let valor = '1';
      const onValorChange = vi.fn((v) => {
        valor = v;
      });

      const { rerender } = render(
        <ModoDinheiroTeclado
          totalCentavos={5000}
          jaPagoCentavos={0}
          valorParcelaCentavos={5000}
          valorRecebidoInput={valor}
          onValorRecebidoChange={onValorChange}
          onConfirmar={vi.fn()}
        />
      );

      // Clicar no 5 -> deve resultar em '15'
      fireEvent.click(screen.getByText('5'));
      expect(onValorChange).toHaveBeenCalledWith('15');

      // Re-render com '15'
      rerender(
        <ModoDinheiroTeclado
          totalCentavos={5000}
          jaPagoCentavos={0}
          valorParcelaCentavos={5000}
          valorRecebidoInput="15"
          onValorRecebidoChange={onValorChange}
          onConfirmar={vi.fn()}
        />
      );

      // Clicar em backspace
      fireEvent.click(screen.getByLabelText(/Apagar dígito/i));
      expect(onValorChange).toHaveBeenCalledWith('1');

      // Clicar em limpar 'C'
      fireEvent.click(screen.getByLabelText(/Limpar valor/i));
      expect(onValorChange).toHaveBeenCalledWith('');
    });
  });

  describe('2. ModalSplitPayment (C11 Dividir a Conta)', () => {
    it('deve calcular cotas iguais por número de pessoas com estrita conservação de centavos', () => {
      const onAplicarCota = vi.fn();
      const onClose = vi.fn();

      // Comanda de R$ 100,00 dividida para 3 pessoas
      const comanda100: Comanda = {
        ...mockComandaBase,
        total: '100.00',
        subtotal: '100.00',
        taxa_servico: '0.00',
      };

      render(
        <ModalSplitPayment
          isOpen={true}
          onClose={onClose}
          comanda={comanda100}
          onAplicarCota={onAplicarCota}
        />
      );

      expect(screen.getByText(/Dividir Conta · Mesa 04/i)).toBeDefined();

      // Inicialmente 2 pessoas (R$ 50,00 cada)
      expect(screen.getByTestId('num-pessoas-display').textContent).toBe('2');
      expect(screen.getByTestId('cota-pessoa-1').textContent).toMatch(/50,00/);
      expect(screen.getByTestId('cota-pessoa-2').textContent).toMatch(/50,00/);

      // Incrementa para 3 pessoas via stepper
      const btnMais = screen.getByLabelText(/Aumentar pessoas/i);
      fireEvent.click(btnMais);

      expect(screen.getByTestId('num-pessoas-display').textContent).toBe('3');

      // 10000 / 3 = 3333 centavos base + resto 1 centavo
      // Pessoa 1 paga 33,34 e Pessoas 2 e 3 pagam 33,33. Total = exatamente 100,00
      const cota1 = screen.getByTestId('cota-pessoa-1');
      const cota2 = screen.getByTestId('cota-pessoa-2');
      const cota3 = screen.getByTestId('cota-pessoa-3');

      expect(cota1.textContent).toMatch(/33,34/);
      expect(cota2.textContent).toMatch(/33,33/);
      expect(cota3.textContent).toMatch(/33,33/);

      // Clica em cobrar cota 1
      const botoesCobrar = screen.getAllByRole('button', { name: /Cobrar Esta Cota/i });
      fireEvent.click(botoesCobrar[0]);

      expect(onAplicarCota).toHaveBeenCalledWith(3334, expect.stringContaining('Cota 1/3'));
      expect(onClose).toHaveBeenCalled();
    });

    it('deve permitir rateio por itens selecionados com cálculo da gorjeta de 10%', () => {
      const onAplicarCota = vi.fn();
      const onClose = vi.fn();

      render(
        <ModalSplitPayment
          isOpen={true}
          onClose={onClose}
          comanda={mockComandaBase}
          onAplicarCota={onAplicarCota}
        />
      );

      // Alternar para aba "Por Itens Consumidos"
      const tabItens = screen.getByRole('button', { name: /Por Itens Consumidos/i });
      fireEvent.click(tabItens);

      expect(screen.getByText(/Selecione os itens a quitar agora/i)).toBeDefined();

      // Itens: Hambúrguer 2x 35 = 70.00; Refrigerante 3x 10 = 30.00
      const checkHamburguer = screen.getByRole('checkbox', {
        name: /2x Hambúrguer Artesanal/i,
      });

      // Seleciona apenas o Hambúrguer
      fireEvent.click(checkHamburguer);

      // Subtotal do hambúrguer: R$ 70,00 + 10% gorjeta (R$ 7,00) = R$ 77,00
      const totalItensElement = screen.getByTestId('total-itens-split');
      expect(totalItensElement.textContent).toMatch(/77,00/);

      // Clica no botão de cobrar cota selecionada
      const btnCobrarItens = screen.getByRole('button', {
        name: /Cobrar Cota Selecionada/i,
      });
      fireEvent.click(btnCobrarItens);

      expect(onAplicarCota).toHaveBeenCalledWith(7700, expect.stringContaining('Itens selecionados (1 item)'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('3. ReciboPaperView (C12 Recibo Térmico .paper)', () => {
    it('deve gerar código de autenticação determinístico e renderizar estrutura da bobina térmica', () => {
      const comandaPaga: Comanda = {
        ...mockComandaBase,
        status: 'paga',
        paga_em: '2026-11-04T22:30:00Z',
      };

      const codigo = gerarCodigoAutenticacao(comandaPaga);
      expect(codigo).toMatch(/^VAPT-20261104-M04-[0-9A-F]{4}$/);

      const onNovaVenda = vi.fn();
      render(
        <ReciboPaperView
          comanda={comandaPaga}
          parcelas={[
            {
              id: 'p1',
              forma: 'dinheiro',
              valorCentavos: 11000,
              valorRecebidoCentavos: 15000,
              trocoCentavos: 4000,
            },
          ]}
          nomeOperador="Operadora Carla"
          documentoCliente="123.456.789-00"
          onNovaVenda={onNovaVenda}
        />
      );

      // Elementos do comprovante
      expect(screen.getByText(/VAPTPDV OPERAÇÕES S.A./i)).toBeDefined();
      expect(screen.getByText(/MESA:\s*04/i)).toBeDefined();
      expect(screen.getByText(/OPERADOR:\s*Operadora Carla/i)).toBeDefined();
      expect(screen.getByText(/CLIENTE \/ CPF:\s*123\.456\.789-00/i)).toBeDefined();
      expect(screen.getByText(/2x Hambúrguer Artesanal/i)).toBeDefined();
      expect(screen.getByText(/3x Refrigerante Lata/i)).toBeDefined();
      expect(screen.getByText(/TROCO DEVOLVIDO:/i)).toBeDefined();

      const codigoElement = screen.getByTestId('codigo-autenticacao-recibo');
      expect(codigoElement.textContent).toBe(codigo);

      // Botão de impressão térmica
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      const btnImprimir = screen.getByRole('button', { name: /Imprimir Recibo/i });
      fireEvent.click(btnImprimir);
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();

      // Botão Nova Venda
      const btnNovaVenda = screen.getByRole('button', { name: /Nova Venda/i });
      fireEvent.click(btnNovaVenda);
      expect(onNovaVenda).toHaveBeenCalled();
    });
  });

  describe('4. ModalCancelarComanda (C13 Confirmação de Segurança com Motivo)', () => {
    it('deve exigir a seleção de motivo e digitação da frase exata para habilitar cancelamento', () => {
      const onConfirmar = vi.fn();
      const onClose = vi.fn();

      render(
        <ModalCancelarComanda
          isOpen={true}
          mesa="04"
          onClose={onClose}
          onConfirmar={onConfirmar}
        />
      );

      expect(screen.getByText(/Comanda da Mesa 04 será cancelada permanentemente/i)).toBeDefined();

      // Botão de confirmação começa desabilitado
      const btnConfirmar = screen.getByTestId('btn-confirmar-cancelamento');
      expect(btnConfirmar.hasAttribute('disabled')).toBe(true);

      // Seleção de motivo (radio)
      const radioDesistencia = screen.getByRole('radio', { name: /Desistência do cliente/i });
      const radioErro = screen.getByRole('radio', { name: /Erro de digitação do garçom/i });

      expect(radioDesistencia).toBeDefined();
      expect(radioErro).toBeDefined();

      fireEvent.click(radioErro);

      // Campo de digitação com texto incorreto
      const input = screen.getByPlaceholderText(FRASE_CANCELAMENTO);
      fireEvent.change(input, { target: { value: 'cancelar' } });
      expect(btnConfirmar.hasAttribute('disabled')).toBe(true);

      // Digitando a frase correta (case-insensitive)
      fireEvent.change(input, { target: { value: 'CANCELAR COMANDA' } });
      expect(btnConfirmar.hasAttribute('disabled')).toBe(false);

      // Submete o cancelamento
      fireEvent.click(btnConfirmar);
      expect(onConfirmar).toHaveBeenCalledWith('Erro de digitação do garçom');
    });

    it('deve permitir motivo "Outro" com texto descritivo', () => {
      const onConfirmar = vi.fn();

      render(
        <ModalCancelarComanda
          isOpen={true}
          mesa="12"
          onClose={vi.fn()}
          onConfirmar={onConfirmar}
        />
      );

      const radioOutro = screen.getByRole('radio', { name: /Outro/i });
      fireEvent.click(radioOutro);

      // Input do motivo 'Outro' aparece
      const inputOutro = screen.getByPlaceholderText(/Descreva brevemente o motivo/i);
      fireEvent.change(inputOutro, { target: { value: 'Mesa solicitou troca de salão' } });

      // Digita a frase de confirmação
      const inputFrase = screen.getByPlaceholderText(FRASE_CANCELAMENTO);
      fireEvent.change(inputFrase, { target: { value: 'cancelar comanda' } });

      const btnConfirmar = screen.getByTestId('btn-confirmar-cancelamento');
      fireEvent.click(btnConfirmar);

      expect(onConfirmar).toHaveBeenCalledWith('Mesa solicitou troca de salão');
    });
  });
});
