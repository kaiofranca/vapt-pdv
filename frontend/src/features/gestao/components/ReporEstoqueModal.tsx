import React, { useState, useEffect, useMemo } from 'react';
import {
  PackagePlus,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useReporEstoque } from '../../../hooks/useProdutos';
import type { Produto } from '../types';

export interface ProdutoParaReposicao {
  id: number;
  nome: string;
  categoria: string;
  estoque: number;
  estoque_minimo?: number;
}

export interface ReporEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: ProdutoParaReposicao | null;
  onRepostoComSucesso?: (produtoAtualizado: Produto, quantidade: number) => void;
}

export const ReporEstoqueModal: React.FC<ReporEstoqueModalProps> = ({
  isOpen,
  onClose,
  produto,
  onRepostoComSucesso,
}) => {
  const reporEstoqueMut = useReporEstoque();

  const [quantidade, setQuantidade] = useState<number>(10);
  const [motivo, setMotivo] = useState<string>('ENTRADA_REPOSICAO_MANUAL');
  const [erroApi, setErroApi] = useState<string | null>(null);

  // Calcula a sugestão inicial ao abrir o modal (EARS-REP-04)
  useEffect(() => {
    if (isOpen && produto) {
      const min = produto.estoque_minimo ?? 5;
      const atual = produto.estoque ?? 0;
      // Diferença entre estoque_minimo * 2 e estoque_atual, no mínimo 10 unidades
      const sugerida = Math.max(10, min * 2 - atual);
      setQuantidade(sugerida);
      setMotivo('ENTRADA_REPOSICAO_MANUAL');
      setErroApi(null);
    }
  }, [isOpen, produto]);

  // Previsão do novo saldo resultante em tempo real (EARS-REP-02, EARS-REP-05)
  const novoSaldoPrevisto = useMemo(() => {
    if (!produto) return 0;
    const qtdNum = Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 0;
    return produto.estoque + qtdNum;
  }, [produto, quantidade]);

  if (!produto) return null;

  const handleIncrementar = (valor: number = 1) => {
    setQuantidade((prev) => Math.max(1, prev + valor));
  };

  const handleDecrementar = (valor: number = 1) => {
    setQuantidade((prev) => Math.max(1, prev - valor));
  };

  const handleAlterarQuantidade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQuantidade(0);
    } else {
      setQuantidade(Math.max(0, val));
    }
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantidade < 1) return;

    setErroApi(null);
    try {
      const resposta = await reporEstoqueMut.mutateAsync({
        id: produto.id,
        quantidade,
        motivo: motivo.trim() || undefined,
      });

      onRepostoComSucesso?.(resposta.produto, quantidade);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErroApi(err.message);
      } else {
        setErroApi(
          'Não foi possível registrar a reposição. Verifique a conexão e tente novamente.'
        );
      }
    }
  };

  const isSalvando = reporEstoqueMut.isPending;
  const isQuantidadeValida = Number.isInteger(quantidade) && quantidade >= 1;
  const estoqueMinimo = produto.estoque_minimo ?? 0;
  const isRegularizado = novoSaldoPrevisto > estoqueMinimo;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Repor Estoque (M06)"
      maxWidth="md"
    >
      <form onSubmit={handleConfirmar} className="flex flex-col gap-5 pt-2">
        {erroApi && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{erroApi}</span>
          </div>
        )}

        {/* Identificação do Produto */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-2 border border-border">
          <div className="p-2.5 rounded-lg bg-brand/10 text-brand-coffee dark:text-amber-300 shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-text text-base truncate">
              {produto.nome}
            </h3>
            <p className="text-xs text-text-2 capitalize">
              Categoria: <strong className="text-text">{produto.categoria}</strong> · ID #{produto.id}
            </p>
          </div>
        </div>

        {/* Quadro Comparativo de Saldo */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-text-2 uppercase tracking-wide">
              Estoque Atual
            </span>
            <span className="text-xl font-black text-text mt-1 font-mono tabular-nums">
              {produto.estoque} un
            </span>
            <span className="text-[10px] text-text-2 mt-0.5">
              mín: {estoqueMinimo}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-brand/10 border border-brand/30 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-brand-coffee dark:text-amber-300 uppercase tracking-wide">
              Reposição
            </span>
            <span className="text-xl font-black text-brand-coffee dark:text-amber-300 mt-1 font-mono tabular-nums">
              +{isQuantidadeValida ? quantidade : 0} un
            </span>
            <span className="text-[10px] text-brand-coffee/80 dark:text-amber-300/80 mt-0.5">
              a adicionar
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border shadow-sm flex flex-col justify-between ${
              isRegularizado
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-surface border-border text-text'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              Saldo Previsto
            </span>
            <span className="text-xl font-black mt-1 font-mono tabular-nums">
              {novoSaldoPrevisto} un
            </span>
            <span className="text-[10px] mt-0.5 flex items-center justify-center gap-1 font-medium">
              {isRegularizado ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Regularizado
                </>
              ) : (
                'Abaixo do mínimo'
              )}
            </span>
          </div>
        </div>

        {/* Seletor Stepper de Quantidade (EARS-REP-02) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-text block">
            Quantidade a Adicionar *
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDecrementar(1)}
              disabled={isSalvando || quantidade <= 1}
              aria-label="Diminuir quantidade"
              className="w-12 h-12 rounded-xl border border-border bg-surface hover:bg-surface-2 text-text font-bold text-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <input
                type="number"
                min="1"
                step="1"
                value={quantidade === 0 ? '' : quantidade}
                onChange={handleAlterarQuantidade}
                disabled={isSalvando}
                aria-label="Quantidade de reposição"
                className="w-full h-12 text-center text-xl font-black font-mono tabular-nums rounded-xl border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-2 pointer-events-none">
                unidades
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleIncrementar(1)}
              disabled={isSalvando}
              aria-label="Aumentar quantidade"
              className="w-12 h-12 rounded-xl border border-border bg-surface hover:bg-surface-2 text-text font-bold text-lg flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Atalhos Rápidos de Incremento */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-text-2 font-medium">Atalhos rápidos:</span>
            {[5, 10, 20, 50].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => handleIncrementar(inc)}
                disabled={isSalvando}
                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-surface hover:bg-surface-2 text-text transition-colors min-h-[32px]"
              >
                +{inc}
              </button>
            ))}
          </div>

          {!isQuantidadeValida && (
            <span className="text-xs text-danger mt-1 block">
              A quantidade deve ser um número inteiro maior ou igual a 1.
            </span>
          )}
        </div>

        {/* Motivo / Observação */}
        <div>
          <label className="text-sm font-semibold text-text block mb-1">
            Motivo / Documento (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex.: Entrada de fornecedor, NF 1234, ajuste"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={isSalvando}
            maxLength={100}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSalvando}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSalvando}
            disabled={!isQuantidadeValida || isSalvando}
            leftIcon={<PackagePlus className="w-4 h-4" />}
          >
            Confirmar Reposição
          </Button>
        </div>
      </form>
    </Modal>
  );
};
