import React, { useState, useEffect } from 'react';
import { X, GitMerge, AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { useMesclarComandas, useComandasAbertas } from '../../../hooks/useComandas';
import { formatCurrency } from '../../../lib/utils';
import { ApiError } from '../../../services/apiClient';
import type { Comanda } from '../../../types/api';

export interface ModalMesclarComandasProps {
  isOpen: boolean;
  comandaDestinoId: number;
  mesaDestino: number | string;
  mesaOrigemSugerida?: number | string;
  onClose: () => void;
  onSucesso?: (comandaAtualizada: Comanda) => void;
}

export const ModalMesclarComandas: React.FC<ModalMesclarComandasProps> = ({
  isOpen,
  comandaDestinoId,
  mesaDestino,
  mesaOrigemSugerida,
  onClose,
  onSucesso,
}) => {
  const [comandaOrigemId, setComandaOrigemId] = useState<number | null>(null);
  const [mesaFiltroManual, setMesaFiltroManual] = useState<string>('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const mesclarComandasMut = useMesclarComandas();
  const { data: comandasAbertas = [], isLoading: isLoadingComandas } = useComandasAbertas();

  // Filtra comandas abertas elegíveis (todas abertas exceto a comanda de destino atual)
  const comandasElegiveis = comandasAbertas.filter(
    (c) => c.id !== comandaDestinoId && c.status === 'aberta'
  );

  // Inicialização ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setErroLocal(null);
      setMesaFiltroManual('');

      // Pré-seleciona comanda sugerida se existir
      if (mesaOrigemSugerida) {
        const comandaSugerida = comandasAbertas.find(
          (c) =>
            (Number(c.mesa) === Number(mesaOrigemSugerida) || String(c.mesa) === String(mesaOrigemSugerida)) &&
            c.id !== comandaDestinoId
        );
        if (comandaSugerida) {
          setComandaOrigemId(comandaSugerida.id);
        } else {
          setComandaOrigemId(null);
        }
      } else {
        setComandaOrigemId(null);
      }
    }
  }, [isOpen, mesaOrigemSugerida, comandaDestinoId, comandasAbertas]);

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

  const comandaOrigemSelecionada = comandasElegiveis.find((c) => c.id === comandaOrigemId);

  // Filtragem rápida de mesas por digitação
  const comandasFiltradas = comandasElegiveis.filter((c) => {
    if (!mesaFiltroManual.trim()) return true;
    return (
      String(c.mesa).includes(mesaFiltroManual.trim()) ||
      (c.nome_cliente && c.nome_cliente.toLowerCase().includes(mesaFiltroManual.toLowerCase()))
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal(null);

    if (!comandaOrigemId) {
      setErroLocal('Selecione uma mesa/comanda de origem para mesclar.');
      return;
    }

    if (comandaOrigemId === comandaDestinoId) {
      setErroLocal('Não é possível mesclar uma comanda em si mesma.');
      return;
    }

    try {
      const comandaConsolidada = await mesclarComandasMut.mutateAsync({
        comandaDestinoId,
        comandaOrigemId,
      });

      onSucesso?.(comandaConsolidada);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.codigo === 'COMANDA_NAO_ABERTA' || err.status === 422) {
          setErroLocal('Apenas comandas com status aberto podem ser mescladas.');
        } else if (err.codigo === 'VALIDACAO' || err.status === 400) {
          setErroLocal(err.message || 'Comanda de origem e destino devem ser distintas.');
        } else {
          setErroLocal(err.message || 'Falha ao mesclar comandas.');
        }
      } else if (err instanceof Error) {
        setErroLocal(err.message);
      } else {
        setErroLocal('Falha ao mesclar comandas. Verifique a conexão com o servidor.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mesclar-comandas-titulo"
    >
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className="relative w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-[28px] p-6 shadow-modal border border-border space-y-5 animate-in slide-in-from-bottom duration-200 z-10 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual da gaveta móvel */}
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        {/* Topo: Título e Botão Fechar X */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-text flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h2
                id="mesclar-comandas-titulo"
                className="text-lg font-black text-text tracking-tight"
              >
                Juntar / Mesclar Mesas
              </h2>
              <p className="text-xs text-text-2">
                Destino: <strong className="text-text font-black">Mesa {mesaDestino}</strong>
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

        {/* Erro Local */}
        {erroLocal && (
          <div
            role="alert"
            className="p-3.5 rounded-[16px] bg-danger-soft border border-danger/30 text-danger-text text-xs font-bold flex items-start gap-2 shrink-0 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
            <span>{erroLocal}</span>
          </div>
        )}

        {/* Aviso de Auditoria e Cancelamento da Origem (EARS-TRANSF-04) */}
        <div className="p-3.5 rounded-[16px] bg-brand-soft border border-brand/30 text-brand-text text-xs leading-relaxed shrink-0">
          <div className="flex items-start gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-brand-edge" />
            <span>Transferência Definitiva de Itens</span>
          </div>
          <p className="text-[11px] opacity-90 pl-6">
            Todos os itens da comanda de origem serão somados a esta mesa (Mesa {mesaDestino}).
            A comanda de origem será <strong>encerrada como cancelada por auditoria</strong> e sua
            mesa será liberada imediatamente no salão.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Campo de Busca Rápida ou Seleção da Origem */}
          <div>
            <label
              htmlFor="mesa-origem-busca"
              className="block text-xs font-bold text-text mb-1.5"
            >
              Mesa / Comanda de Origem
            </label>
            <input
              id="mesa-origem-busca"
              type="text"
              placeholder="Digite o número da mesa de origem..."
              value={mesaFiltroManual}
              onChange={(e) => {
                setMesaFiltroManual(e.target.value);
                setErroLocal(null);
              }}
              className="w-full px-4 py-2.5 rounded-[14px] bg-surface-2 border border-border text-text font-bold text-sm focus:outline-none focus:border-brand mb-2"
            />
          </div>

          {/* Lista de Comandas Elegíveis */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-text-2 uppercase tracking-wider block">
              Selecione a comanda aberta para incorporar:
            </span>

            {isLoadingComandas ? (
              <p className="text-xs text-text-2 py-4 text-center">Carregando mesas do salão...</p>
            ) : comandasFiltradas.length === 0 ? (
              <div className="p-4 rounded-[16px] bg-surface-2 text-center text-xs text-text-2">
                Nenhuma outra comanda aberta encontrada para mesclar.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {comandasFiltradas.map((cmd) => {
                  const isSelecionada = cmd.id === comandaOrigemId;
                  const totalStr = cmd.total || cmd.subtotal || '0.00';
                  const qtdItens = cmd.itens?.length ?? 0;

                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => {
                        setComandaOrigemId(cmd.id);
                        setErroLocal(null);
                      }}
                      className={`w-full p-3 rounded-[16px] border text-left flex items-center justify-between transition-all ${
                        isSelecionada
                          ? 'border-brand bg-brand-soft text-brand-text shadow-sm'
                          : 'border-border bg-surface hover:bg-surface-2 text-text'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            isSelecionada
                              ? 'bg-brand text-on-brand'
                              : 'bg-surface-2 text-text border border-border'
                          }`}
                        >
                          {cmd.mesa}
                        </div>
                        <div>
                          <div className="text-xs font-black">
                            Mesa {cmd.mesa} {cmd.nome_cliente ? `· ${cmd.nome_cliente}` : ''}
                          </div>
                          <div className="text-[11px] text-text-2">
                            {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {formatCurrency(totalStr)}
                          </div>
                        </div>
                      </div>

                      {isSelecionada && (
                        <div className="w-6 h-6 rounded-full bg-brand text-on-brand flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo da Mesclagem Selecionada */}
          {comandaOrigemSelecionada && (
            <div className="p-3 rounded-[14px] bg-surface-2 border border-border text-xs flex items-center justify-between">
              <div>
                <span className="text-text-2 block text-[11px]">Origem selecionada:</span>
                <span className="font-extrabold text-text">
                  Mesa {comandaOrigemSelecionada.mesa} (Comanda #{comandaOrigemSelecionada.id})
                </span>
              </div>
              <div className="text-right">
                <span className="text-text-2 block text-[11px]">Valor a somar:</span>
                <span className="font-black text-brand-text">
                  {formatCurrency(comandaOrigemSelecionada.total || comandaOrigemSelecionada.subtotal || '0.00')}
                </span>
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-3 border-t border-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={mesclarComandasMut.isPending}
              className="flex-1 min-h-[48px] rounded-[16px] bg-surface hover:bg-surface-2 border border-border text-text font-bold text-xs active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={mesclarComandasMut.isPending || !comandaOrigemId}
              className="flex-1 min-h-[48px] rounded-[16px] bg-brand hover:bg-brand-hover text-on-brand font-black text-xs shadow-soft flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {mesclarComandasMut.isPending ? (
                <span>Unificando comandas...</span>
              ) : (
                <>
                  <GitMerge className="w-4 h-4" />
                  <span>Confirmar Junção</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalMesclarComandas;
