import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, AlertCircle, GitMerge } from 'lucide-react';
import { useTransferirMesa, useComandasAbertas } from '../../../hooks/useComandas';
import { ApiError } from '../../../services/apiClient';
import type { Comanda } from '../../../types/api';

export interface ModalTransferirMesaProps {
  isOpen: boolean;
  comandaId: number;
  mesaAtual: number | string;
  onClose: () => void;
  onSucesso?: (comandaAtualizada: Comanda) => void;
  onAbrirMesclar?: (mesaOcupada: number) => void;
}

export const ModalTransferirMesa: React.FC<ModalTransferirMesaProps> = ({
  isOpen,
  comandaId,
  mesaAtual,
  onClose,
  onSucesso,
  onAbrirMesclar,
}) => {
  const [novaMesa, setNovaMesa] = useState<string>('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [mesaOcupadaConflito, setMesaOcupadaConflito] = useState<number | null>(null);

  const transferirMesaMut = useTransferirMesa();
  const { data: comandasAbertas = [] } = useComandasAbertas();

  // Reset estado ao abrir
  useEffect(() => {
    if (isOpen) {
      setNovaMesa('');
      setErroLocal(null);
      setMesaOcupadaConflito(null);
    }
  }, [isOpen]);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Validação em tempo real se a mesa já está ocupada por outra comanda aberta (EARS-TRANSF-06)
  const mesaNum = parseInt(novaMesa.trim(), 10);
  const mesaJaOcupada =
    !isNaN(mesaNum) &&
    mesaNum > 0 &&
    comandasAbertas.some(
      (c) => Number(c.mesa) === mesaNum && c.id !== comandaId && c.status === 'aberta'
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal(null);
    setMesaOcupadaConflito(null);

    const mesaTrim = novaMesa.trim();
    if (!mesaTrim) {
      setErroLocal('Informe o número da nova mesa.');
      return;
    }

    const parsedMesa = parseInt(mesaTrim, 10);
    if (isNaN(parsedMesa) || parsedMesa <= 0) {
      setErroLocal('O número da mesa deve ser um número inteiro maior que 0.');
      return;
    }

    if (parsedMesa === Number(mesaAtual)) {
      setErroLocal('A nova mesa deve ser diferente da mesa atual.');
      return;
    }

    try {
      const comandaAtualizada = await transferirMesaMut.mutateAsync({
        comandaId,
        novaMesa: parsedMesa,
      });

      onSucesso?.(comandaAtualizada);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.codigo === 'MESA_OCUPADA' || err.status === 409) {
          setMesaOcupadaConflito(parsedMesa);
          setErroLocal(`A mesa ${parsedMesa} já possui comanda aberta.`);
        } else if (err.codigo === 'COMANDA_NAO_ABERTA' || err.status === 422) {
          setErroLocal('Apenas comandas abertas podem ser transferidas de mesa.');
        } else {
          setErroLocal(err.message || 'Erro ao transferir mesa.');
        }
      } else if (err instanceof Error) {
        setErroLocal(err.message);
      } else {
        setErroLocal('Falha ao transferir mesa. Verifique a conexão com o servidor.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transferir-mesa-titulo"
    >
      {/* Backdrop click handler */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-[28px] p-6 shadow-modal border border-border space-y-5 animate-in slide-in-from-bottom duration-200 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual da gaveta móvel */}
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        {/* Topo: Título e Botão Fechar X */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-text flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h2
                id="transferir-mesa-titulo"
                className="text-lg font-black text-text tracking-tight"
              >
                Transferir Mesa
              </h2>
              <p className="text-xs text-text-2">
                Mesa atual: <strong className="text-text font-black">Mesa {mesaAtual}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-surface-2 hover:bg-border flex items-center justify-center text-text-2 hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aviso de erro / Mesa Ocupada (EARS-TRANSF-08) */}
        {(erroLocal || (mesaJaOcupada && !erroLocal)) && (
          <div
            role="alert"
            className="p-3.5 rounded-[16px] bg-danger-soft border border-danger/30 text-danger-text text-xs space-y-2 animate-in fade-in"
          >
            <div className="flex items-start gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>
                {erroLocal || `A mesa ${mesaNum} já possui comanda aberta.`}
              </span>
            </div>

            {(mesaOcupadaConflito || mesaJaOcupada) && onAbrirMesclar && (
              <div className="pt-1 border-t border-danger/20 flex items-center justify-between">
                <span className="text-[11px] text-danger-text">
                  Deseja juntar as contas desta mesa?
                </span>
                <button
                  type="button"
                  onClick={() => onAbrirMesclar(mesaOcupadaConflito ?? mesaNum)}
                  className="px-3 py-1.5 rounded-full bg-danger text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Mesclar Comandas</span>
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="nova-mesa-input"
              className="block text-xs font-bold text-text mb-1.5"
            >
              Nova Mesa
            </label>
            <input
              id="nova-mesa-input"
              type="number"
              min="1"
              step="1"
              autoFocus
              placeholder="Ex: 8"
              value={novaMesa}
              onChange={(e) => {
                setNovaMesa(e.target.value);
                setErroLocal(null);
                setMesaOcupadaConflito(null);
              }}
              aria-label="Nova mesa"
              className={`w-full px-4 py-3 rounded-[16px] bg-surface-2 border text-text font-bold text-base focus:outline-none focus:ring-2 transition-colors ${
                mesaJaOcupada || mesaOcupadaConflito
                  ? 'border-danger focus:ring-danger text-danger'
                  : 'border-border focus:border-brand focus:ring-brand/30'
              }`}
            />
            <p className="text-[11px] text-text-2 mt-1.5">
              Informe o número da mesa desocupada para onde o cliente será transferido.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={transferirMesaMut.isPending}
              className="flex-1 min-h-[48px] rounded-[16px] bg-surface hover:bg-surface-2 border border-border text-text font-bold text-xs active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                transferirMesaMut.isPending ||
                !novaMesa.trim() ||
                mesaJaOcupada ||
                Number(novaMesa.trim()) === Number(mesaAtual)
              }
              className="flex-1 min-h-[48px] rounded-[16px] bg-brand hover:bg-brand-hover text-on-brand font-black text-xs shadow-soft flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {transferirMesaMut.isPending ? (
                <span>Transferindo...</span>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Confirmar Transferência</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalTransferirMesa;
