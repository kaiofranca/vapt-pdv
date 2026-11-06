import React from 'react';
import { Banknote, Delete, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface ModoDinheiroTecladoProps {
  /** Valor total da comanda em centavos */
  totalCentavos: number;
  /** Valor já pago acumulado em centavos */
  jaPagoCentavos: number;
  /** Valor da parcela a quitar nesta operação em centavos */
  valorParcelaCentavos: number;
  /** String digitada pelo operador para o valor entregue pelo cliente */
  valorRecebidoInput: string;
  /** Callback para atualizar o valor entregue */
  onValorRecebidoChange: (novoValor: string) => void;
  /** Callback para confirmar a parcela em dinheiro */
  onConfirmar: () => void;
  /** Se a confirmação está desabilitada */
  disabled?: boolean;
}

/**
 * Componente C07 - Pagamento em Dinheiro com Teclado Touch e Troco em Tempo Real
 * Atende às diretrizes do DESIGN.md:
 * - Cores semânticas: Café, Mostarda, Manjericão (success), Creme
 * - Sem emojis
 * - font-variant-numeric: tabular-nums
 * - Alvos de toque >= 44x44px
 */
export const ModoDinheiroTeclado: React.FC<ModoDinheiroTecladoProps> = ({
  totalCentavos,
  jaPagoCentavos,
  valorParcelaCentavos,
  valorRecebidoInput,
  onValorRecebidoChange,
  onConfirmar,
  disabled = false,
}) => {
  const faltaPagarCentavos = Math.max(0, totalCentavos - jaPagoCentavos);

  // Conversão segura para centavos inteiros (evita resíduos binários de ponto flutuante)
  const valorRecebidoNum = parseFloat(valorRecebidoInput.replace(',', '.'));
  const valorRecebidoCentavos = Number.isFinite(valorRecebidoNum)
    ? Math.round(valorRecebidoNum * 100)
    : 0;

  // Troco instantâneo
  const trocoCentavos = Math.max(0, valorRecebidoCentavos - valorParcelaCentavos);
  const valorInsuficiente = valorRecebidoCentavos < valorParcelaCentavos;

  // Percentual já quitado para a barra de progresso
  const percentualQuitado =
    totalCentavos > 0
      ? Math.min(100, Math.round((jaPagoCentavos / totalCentavos) * 100))
      : 0;

  // Manipulação de teclas do teclado touch
  const handleKeyClick = (tecla: string) => {
    if (tecla === 'C') {
      onValorRecebidoChange('');
      return;
    }
    if (tecla === 'backspace') {
      onValorRecebidoChange(valorRecebidoInput.slice(0, -1));
      return;
    }
    if (tecla === ',') {
      if (!valorRecebidoInput.includes(',') && !valorRecebidoInput.includes('.')) {
        onValorRecebidoChange(valorRecebidoInput ? `${valorRecebidoInput},` : '0,');
      }
      return;
    }
    // Limita a duas casas decimais
    const partes = valorRecebidoInput.split(/[,.]/);
    if (partes.length > 1 && partes[1].length >= 2) {
      return;
    }
    if (valorRecebidoInput === '0') {
      onValorRecebidoChange(tecla);
    } else {
      onValorRecebidoChange(`${valorRecebidoInput}${tecla}`);
    }
  };

  // Botões rápidos de cédulas fixas
  const handleSetCedula = (valor: number) => {
    onValorRecebidoChange(valor.toFixed(2).replace('.', ','));
  };

  // Botão Valor Exato
  const handleValorExato = () => {
    const exato = (valorParcelaCentavos / 100).toFixed(2).replace('.', ',');
    onValorRecebidoChange(exato);
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-card bg-surface-2/60 border border-border">
      {/* Barra de Progresso de Quitação: Já Pago vs Falta Pagar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-success-text tabular-nums">
            Já pago: {formatCurrency(jaPagoCentavos / 100)}
          </span>
          <span
            className={`tabular-nums ${
              faltaPagarCentavos > 0 ? 'text-danger-text' : 'text-success-text'
            }`}
          >
            {faltaPagarCentavos > 0
              ? `Falta: ${formatCurrency(faltaPagarCentavos / 100)}`
              : 'Totalmente Quitado'}
          </span>
        </div>
        <div
          className="w-full h-3 rounded-full bg-surface border border-border overflow-hidden"
          role="progressbar"
          aria-valuenow={percentualQuitado}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-success transition-all duration-300 rounded-full"
            style={{ width: `${percentualQuitado}%` }}
          />
        </div>
      </div>

      {/* Input de Valor Entregue */}
      <div>
        <label
          htmlFor="valor-recebido-dinheiro"
          className="text-xs font-bold uppercase text-text-2 tracking-wider block mb-1"
        >
          Valor Entregue pelo Cliente
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-2 text-sm select-none">
            R$
          </span>
          <input
            id="valor-recebido-dinheiro"
            type="text"
            inputMode="decimal"
            value={valorRecebidoInput}
            onChange={(e) => onValorRecebidoChange(e.target.value)}
            placeholder="0,00"
            className="w-full min-h-[48px] pl-10 pr-4 py-2 rounded-input bg-surface border border-border text-text font-black text-xl tabular-nums focus:outline-none focus:border-brand-edge focus:ring-1 focus:ring-brand-edge shadow-soft"
          />
        </div>
      </div>

      {/* Botões Rápidos de Cédulas ("R$ 20", "R$ 50", "R$ 100", "Valor exato") */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleSetCedula(20)}
          className="min-h-[44px] px-3.5 py-2 rounded-btn bg-surface border border-border text-xs font-bold text-text hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft"
        >
          R$ 20
        </button>
        <button
          type="button"
          onClick={() => handleSetCedula(50)}
          className="min-h-[44px] px-3.5 py-2 rounded-btn bg-surface border border-border text-xs font-bold text-text hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft"
        >
          R$ 50
        </button>
        <button
          type="button"
          onClick={() => handleSetCedula(100)}
          className="min-h-[44px] px-3.5 py-2 rounded-btn bg-surface border border-border text-xs font-bold text-text hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft"
        >
          R$ 100
        </button>
        <button
          type="button"
          onClick={handleValorExato}
          className="min-h-[44px] px-3.5 py-2 rounded-btn bg-brand-soft border border-brand/30 text-xs font-bold text-brand-text hover:bg-brand/20 active:bg-brand/30 transition-colors ml-auto shadow-soft"
        >
          Valor Exato
        </button>
      </div>

      {/* Teclado Numérico Touch (0 a 9, backspace, limpar 'C', vírgula ',') */}
      <div className="grid grid-cols-3 gap-2 pt-1" aria-label="Teclado numérico">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeyClick(num)}
            className="min-h-[46px] rounded-btn font-mono font-bold text-base bg-surface text-text border border-border hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft flex items-center justify-center select-none"
          >
            {num}
          </button>
        ))}

        {/* Linha inferior: Limpar (C), 0, Backspace */}
        <button
          type="button"
          onClick={() => handleKeyClick('C')}
          title="Limpar valor"
          aria-label="Limpar valor"
          className="min-h-[46px] rounded-btn font-mono font-bold text-sm bg-danger-soft text-danger border border-danger/30 hover:bg-danger/20 active:bg-danger/30 transition-colors shadow-soft flex items-center justify-center gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          <span>C</span>
        </button>

        <button
          type="button"
          onClick={() => handleKeyClick('0')}
          className="min-h-[46px] rounded-btn font-mono font-bold text-base bg-surface text-text border border-border hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft flex items-center justify-center select-none"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => handleKeyClick('backspace')}
          title="Apagar dígito"
          aria-label="Apagar dígito"
          className="min-h-[46px] rounded-btn font-mono font-bold text-sm bg-surface text-text border border-border hover:bg-surface-2 active:bg-border/60 transition-colors shadow-soft flex items-center justify-center"
        >
          <Delete className="w-5 h-5 text-text-2" />
        </button>

        {/* Linha adicional para vírgula se necessário */}
        <div className="col-span-3 flex justify-center">
          <button
            type="button"
            onClick={() => handleKeyClick(',')}
            className="w-full min-h-[44px] rounded-btn font-mono font-bold text-base bg-surface-2 text-text border border-border hover:bg-border/40 active:bg-border/60 transition-colors shadow-soft flex items-center justify-center"
          >
            , (centavos)
          </button>
        </div>
      </div>

      {/* Destaque do Troco em Cor Manjericão (Success) */}
      <div
        className={`p-3.5 rounded-card border transition-all text-center ${
          trocoCentavos > 0
            ? 'bg-success-soft border-success/40'
            : valorInsuficiente && valorRecebidoCentavos > 0
            ? 'bg-danger-soft border-danger/40'
            : 'bg-surface border-border'
        }`}
      >
        <span
          className={`text-xs uppercase font-extrabold tracking-wider block ${
            trocoCentavos > 0
              ? 'text-success-text'
              : valorInsuficiente && valorRecebidoCentavos > 0
              ? 'text-danger-text'
              : 'text-text-2'
          }`}
        >
          {trocoCentavos > 0
            ? 'Troco a Devolver'
            : valorInsuficiente && valorRecebidoCentavos > 0
            ? 'Valor Insuficiente'
            : 'Sem Troco (Valor Correto)'}
        </span>
        <span
          className={`text-2xl font-black tabular-nums block mt-0.5 ${
            trocoCentavos > 0
              ? 'text-success'
              : valorInsuficiente && valorRecebidoCentavos > 0
              ? 'text-danger'
              : 'text-text'
          }`}
          data-testid="valor-troco"
        >
          {formatCurrency(trocoCentavos / 100)}
        </span>
      </div>

      {/* Ação de Confirmar Dinheiro */}
      <Button
        variant="primary"
        fullWidth
        leftIcon={<Banknote className="w-5 h-5" />}
        onClick={onConfirmar}
        disabled={disabled || valorParcelaCentavos <= 0 || valorInsuficiente}
        className="min-h-[48px] text-sm font-bold"
      >
        Confirmar Pagamento em Dinheiro
      </Button>
    </div>
  );
};
