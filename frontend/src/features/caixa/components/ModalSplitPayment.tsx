import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckSquare,
  Plus,
  Minus,
  CreditCard,
  Percent,
} from 'lucide-react';
import type { Comanda, ItemComanda } from '../../../types/api';
import { formatCurrency } from '../../../lib/utils';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';

export interface ModalSplitPaymentProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: Comanda | null;
  /** Callback acionado quando o operador escolhe uma cota calculada para pagar */
  onAplicarCota: (valorCentavos: number, descricao: string) => void;
}

export type TipoDivisao = 'pessoas' | 'itens';

export interface CotaPessoa {
  indice: number;
  valorCentavos: number;
  valorFormatado: string;
}

/**
 * Modal C11 - Dividir a Conta (Split Payment)
 * Suporta:
 * 1. Divisão por número de pessoas (2 a 20) com conservação exata de centavos (RN19/RN24)
 * 2. Divisão por itens selecionados (com ou sem taxa de 10%)
 */
export const ModalSplitPayment: React.FC<ModalSplitPaymentProps> = ({
  isOpen,
  onClose,
  comanda,
  onAplicarCota,
}) => {
  const [tipoDivisao, setTipoDivisao] = useState<TipoDivisao>('pessoas');
  const [numPessoas, setNumPessoas] = useState<number>(2);
  const [itensSelecionados, setItensSelecionados] = useState<Record<number, boolean>>({});
  const [incluirTaxaItens, setIncluirTaxaItens] = useState<boolean>(true);

  const itens: ItemComanda[] = useMemo(() => comanda?.itens || [], [comanda]);

  // Total da comanda em centavos
  const totalComandaCentavos = useMemo(() => {
    if (!comanda) return 0;
    const val = parseFloat(comanda.total || comanda.subtotal || '0');
    return Math.round(val * 100);
  }, [comanda]);

  // Cálculo das cotas por pessoas com conservação de centavos
  const cotasPessoas: CotaPessoa[] = useMemo(() => {
    if (totalComandaCentavos <= 0 || numPessoas < 2) return [];

    const baseCentavos = Math.floor(totalComandaCentavos / numPessoas);
    const restoCentavos = totalComandaCentavos % numPessoas;

    const lista: CotaPessoa[] = [];
    for (let i = 0; i < numPessoas; i++) {
      // Distribui 1 centavo extra para os primeiros 'restoCentavos' participantes
      const cota = i < restoCentavos ? baseCentavos + 1 : baseCentavos;
      lista.push({
        indice: i + 1,
        valorCentavos: cota,
        valorFormatado: formatCurrency(cota / 100),
      });
    }
    return lista;
  }, [totalComandaCentavos, numPessoas]);

  // Itens selecionados para rateio parcial
  const handleToggleItem = (itemId: number) => {
    setItensSelecionados((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSelecionarTodosItens = () => {
    const todos: Record<number, boolean> = {};
    itens.forEach((it) => {
      todos[it.id] = true;
    });
    setItensSelecionados(todos);
  };

  const handleLimparSelecaoItens = () => {
    setItensSelecionados({});
  };

  // Cálculo do rateio por itens selecionados
  const { subtotalItensCentavos, taxaItensCentavos, totalItensCentavos, qtdItensSelecionados } =
    useMemo(() => {
      let subtotalCentavos = 0;
      let qtd = 0;

      itens.forEach((it) => {
        if (itensSelecionados[it.id]) {
          const precoUnitario = parseFloat(it.preco_copiado || '0');
          const subtotalItem = Math.round(precoUnitario * it.quantidade * 100);
          subtotalCentavos += subtotalItem;
          qtd += 1;
        }
      });

      const taxaCentavos = incluirTaxaItens ? Math.round(subtotalCentavos * 0.1) : 0;
      const totalCentavos = subtotalCentavos + taxaCentavos;

      return {
        subtotalItensCentavos: subtotalCentavos,
        taxaItensCentavos: taxaCentavos,
        totalItensCentavos: totalCentavos,
        qtdItensSelecionados: qtd,
      };
    }, [itens, itensSelecionados, incluirTaxaItens]);

  // Handlers do Stepper de Pessoas
  const handleDecrementarPessoas = () => {
    setNumPessoas((prev) => Math.max(2, prev - 1));
  };

  const handleIncrementarPessoas = () => {
    setNumPessoas((prev) => Math.min(20, prev + 1));
  };

  // Ao selecionar uma cota de pessoa para pagar
  const handleEscolherCotaPessoa = (cota: CotaPessoa) => {
    onAplicarCota(
      cota.valorCentavos,
      `Cota ${cota.indice}/${numPessoas} (divisão igual)`
    );
    onClose();
  };

  // Ao confirmar cota dos itens selecionados
  const handleEscolherCotaItens = () => {
    if (totalItensCentavos <= 0) return;
    onAplicarCota(
      totalItensCentavos,
      `Itens selecionados (${qtdItensSelecionados} item${qtdItensSelecionados > 1 ? 's' : ''})`
    );
    onClose();
  };

  if (!isOpen || !comanda) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dividir Conta · Mesa ${comanda.mesa}`}
      maxWidth="md"
    >
      <div className="space-y-4 py-1">
        {/* Total da Comanda em Destaque */}
        <div className="p-3.5 rounded-card bg-surface-2/60 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-text-2 tracking-wider block">
              Total da Comanda
            </span>
            <span className="text-xs text-text-2">
              Mesa {comanda.mesa} · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <span className="text-xl font-black text-text tabular-nums" data-testid="total-comanda-split">
            {formatCurrency(totalComandaCentavos / 100)}
          </span>
        </div>

        {/* SegmentedControl para alternar entre Por Pessoas e Por Itens */}
        <div className="grid grid-cols-2 p-1 rounded-control bg-surface-2 border border-border">
          <button
            type="button"
            onClick={() => setTipoDivisao('pessoas')}
            className={`min-h-[44px] px-3 rounded-btn text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              tipoDivisao === 'pessoas'
                ? 'bg-brand text-on-brand shadow-soft'
                : 'text-text-2 hover:text-text'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Por Pessoas ({numPessoas})</span>
          </button>

          <button
            type="button"
            onClick={() => setTipoDivisao('itens')}
            className={`min-h-[44px] px-3 rounded-btn text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              tipoDivisao === 'itens'
                ? 'bg-brand text-on-brand shadow-soft'
                : 'text-text-2 hover:text-text'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Por Itens Consumidos</span>
          </button>
        </div>

        {/* ================= ABA 1: DIVISÃO POR NÚMERO DE PESSOAS ================= */}
        {tipoDivisao === 'pessoas' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Stepper de Quantidade de Pessoas (2 a 20) */}
            <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase text-text-2 tracking-wider block">
                  Número de Pessoas
                </span>
                <span className="text-xs text-text-2">
                  Divisão igualitária preservando centavos exatos
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrementarPessoas}
                  disabled={numPessoas <= 2}
                  className="w-11 h-11 rounded-btn bg-surface-2 border border-border text-text font-bold flex items-center justify-center hover:bg-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Diminuir pessoas"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <div className="w-14 text-center">
                  <span
                    className="text-2xl font-black text-text tabular-nums"
                    data-testid="num-pessoas-display"
                  >
                    {numPessoas}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleIncrementarPessoas}
                  disabled={numPessoas >= 20}
                  className="w-11 h-11 rounded-btn bg-surface-2 border border-border text-text font-bold flex items-center justify-center hover:bg-border/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Aumentar pessoas"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lista das Cotas Calculadas */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-text-2 uppercase tracking-wider">
                <span>Cotas Individuais</span>
                <span>Soma: {formatCurrency(totalComandaCentavos / 100)}</span>
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {cotasPessoas.map((cota) => (
                  <div
                    key={cota.indice}
                    className="p-3 rounded-input bg-surface border border-border flex items-center justify-between hover:border-brand-edge transition-colors shadow-soft"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-soft text-brand-text font-bold text-xs flex items-center justify-center">
                        {cota.indice}
                      </div>
                      <span className="font-semibold text-text text-sm">
                        Pessoa {cota.indice}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="font-black text-text text-base tabular-nums"
                        data-testid={`cota-pessoa-${cota.indice}`}
                      >
                        {cota.valorFormatado}
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleEscolherCotaPessoa(cota)}
                        className="min-h-[38px] text-xs font-bold"
                      >
                        Cobrar Esta Cota
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: DIVISÃO POR ITENS CONSUMIDOS ================= */}
        {tipoDivisao === 'itens' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase text-text-2 tracking-wider">
                Selecione os itens a quitar agora:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelecionarTodosItens}
                  className="text-xs font-semibold text-brand-text hover:underline"
                >
                  Marcar todos
                </button>
                <span className="text-text-2">·</span>
                <button
                  type="button"
                  onClick={handleLimparSelecaoItens}
                  className="text-xs font-semibold text-text-2 hover:underline"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            {/* Lista dos Itens da Comanda */}
            <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1 border border-border rounded-card p-2 bg-surface">
              {itens.length > 0 ? (
                itens.map((it) => {
                  const unit = parseFloat(it.preco_copiado || '0');
                  const itemTotalCentavos = Math.round(unit * it.quantidade * 100);
                  const isChecked = !!itensSelecionados[it.id];

                  return (
                    <label
                      key={it.id}
                      className={`flex items-center justify-between p-2.5 rounded-input cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-brand-soft/60 border-brand-edge'
                          : 'bg-surface hover:bg-surface-2 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(it.id)}
                          className="w-4 h-4 rounded border-border text-brand focus:ring-brand accent-[#F2A81D]"
                        />
                        <div>
                          <span className="text-xs font-bold text-text block">
                            {it.quantidade}x {it.nome_copiado}
                          </span>
                          <span className="text-[11px] text-text-2 tabular-nums">
                            {formatCurrency(unit)} un.
                          </span>
                        </div>
                      </div>

                      <span className="font-black text-text text-xs tabular-nums">
                        {formatCurrency(itemTotalCentavos / 100)}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-text-2">
                  Esta comanda não possui itens para divisão.
                </div>
              )}
            </div>

            {/* Switch de Taxa de Serviço 10% */}
            <div className="flex items-center justify-between p-3 rounded-card bg-surface-2/60 border border-border">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-text-2" />
                <span className="text-xs font-bold text-text">
                  Aplicar Gorjeta (10%) sobre os itens selecionados
                </span>
              </div>
              <ToggleSwitch
                checked={incluirTaxaItens}
                onChange={setIncluirTaxaItens}
              />
            </div>

            {/* Resumo da Cota de Itens */}
            <div className="p-3.5 rounded-card bg-surface border border-border space-y-1.5">
              <div className="flex justify-between text-xs text-text-2">
                <span>Subtotal Itens Marcados ({qtdItensSelecionados})</span>
                <span className="font-bold text-text tabular-nums">
                  {formatCurrency(subtotalItensCentavos / 100)}
                </span>
              </div>
              {incluirTaxaItens && (
                <div className="flex justify-between text-xs text-text-2">
                  <span>Gorjeta (10%)</span>
                  <span className="font-bold text-text tabular-nums">
                    {formatCurrency(taxaItensCentavos / 100)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-border">
                <span className="font-extrabold text-sm text-text">Total da Parcela</span>
                <span
                  className="font-black text-lg text-text tabular-nums"
                  data-testid="total-itens-split"
                >
                  {formatCurrency(totalItensCentavos / 100)}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              leftIcon={<CreditCard className="w-4 h-4" />}
              onClick={handleEscolherCotaItens}
              disabled={totalItensCentavos <= 0}
              className="min-h-[44px] font-bold text-xs"
            >
              Cobrar Cota Selecionada ({formatCurrency(totalItensCentavos / 100)})
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
};
