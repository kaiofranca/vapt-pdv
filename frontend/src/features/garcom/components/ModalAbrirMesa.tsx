import React, { useState, useEffect } from 'react';
import { X, Users, User, Minus, Plus, AlertCircle } from 'lucide-react';
import { useAbrirComanda } from '../../../hooks/useComandas';
import { useGarconsAtivos } from '../../../hooks/useUsuarios';
import { ApiError } from '../../../services/apiClient';
import type { Comanda } from '../../../types/api';

export interface ModalAbrirMesaProps {
  isOpen: boolean;
  mesaPredefinida?: string;
  garcomPadraoId?: number | null;
  onClose: () => void;
  onMesaAberta: (comanda: Comanda) => void;
  onErrorToast?: (mensagem: string) => void;
}

export const ModalAbrirMesa: React.FC<ModalAbrirMesaProps> = ({
  isOpen,
  mesaPredefinida = '',
  garcomPadraoId,
  onClose,
  onMesaAberta,
  onErrorToast,
}) => {
  const [mesa, setMesa] = useState(mesaPredefinida);
  const [qtdPessoas, setQtdPessoas] = useState<number>(2);
  const [nomeCliente, setNomeCliente] = useState('');
  const [garcomId, setGarcomId] = useState<number | null>(garcomPadraoId ?? null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const { data: garcons = [] } = useGarconsAtivos();
  const abrirComandaMut = useAbrirComanda();

  useEffect(() => {
    if (mesaPredefinida) {
      setMesa(mesaPredefinida);
    }
  }, [mesaPredefinida]);

  useEffect(() => {
    if (isOpen) {
      setErroLocal(null);
      setQtdPessoas(2);
      if (mesaPredefinida) {
        setMesa(mesaPredefinida);
      }
      if (garcomPadraoId) {
        setGarcomId(garcomPadraoId);
      } else if (garcons.length > 0) {
        setGarcomId(garcons[0].id);
      }
    }
  }, [isOpen, mesaPredefinida, garcomPadraoId, garcons]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal(null);

    const mesaTrim = mesa.trim();
    if (!mesaTrim) {
      setErroLocal('Informe o número da mesa.');
      return;
    }

    const idGarcomValido = garcomId || (garcons.length > 0 ? garcons[0].id : 1);

    let clienteDescricao = nomeCliente.trim();
    if (qtdPessoas > 1) {
      clienteDescricao = clienteDescricao
        ? `${clienteDescricao} (${qtdPessoas} pessoas)`
        : `${qtdPessoas} pessoas`;
    }

    try {
      const novaComanda = await abrirComandaMut.mutateAsync({
        mesa: mesaTrim,
        garcom_id: idGarcomValido,
        nome_cliente: clienteDescricao || undefined,
      });

      setNomeCliente('');
      onMesaAberta(novaComanda);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.codigo === 'MESA_OCUPADA') {
          setErroLocal(`A mesa ${mesaTrim} já possui uma comanda aberta no salão.`);
        } else {
          setErroLocal(err.message);
        }
      } else {
        setErroLocal('Falha ao abrir comanda. Verifique a conexão com o servidor.');
      }
      onErrorToast?.('Não foi possível abrir a comanda.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-[28px] p-6 shadow-modal border border-border space-y-6 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-text tracking-tight">
            Abrir Mesa {mesa || '...'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-2 hover:bg-border flex items-center justify-center text-text-2 hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {erroLocal && (
          <div className="p-3.5 rounded-[14px] bg-danger-soft border border-danger/30 text-danger-text text-xs font-bold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erroLocal}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!mesaPredefinida && (
            <div>
              <label className="block text-xs font-bold text-text mb-1.5">Número da Mesa</label>
              <input
                type="text"
                autoFocus
                placeholder="Ex: 5"
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                className="w-full px-4 py-3 rounded-[16px] bg-surface-2 border border-border text-text font-bold text-base focus:outline-none focus:border-brand"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-text mb-1.5">Quantas pessoas?</label>
            <div className="flex items-center justify-between p-3 rounded-[20px] border border-border bg-surface">
              <div className="flex items-center gap-2 pl-2 text-text-2">
                <Users className="w-5 h-5" />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setQtdPessoas((prev) => Math.max(1, prev - 1))}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all"
                  aria-label="Diminuir pessoas"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="text-2xl font-black text-text tabular-nums w-8 text-center">
                  {qtdPessoas}
                </span>

                <button
                  type="button"
                  onClick={() => setQtdPessoas((prev) => prev + 1)}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all"
                  aria-label="Aumentar pessoas"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1.5">
              Nome na comanda <span className="text-text-2 font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-text-2 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Ex.: Aniversário da Carol"
                className="w-full pl-11 pr-4 py-3.5 rounded-[16px] border border-border bg-surface text-text text-sm placeholder:text-text-2/60 focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={abrirComandaMut.isPending}
            className="w-full h-14 rounded-[18px] bg-brand hover:bg-brand-hover text-on-brand font-black text-sm shadow-soft transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {abrirComandaMut.isPending ? 'Abrindo comanda no banco...' : 'Abrir e lançar itens'}
          </button>
        </form>
      </div>
    </div>
  );
};
