import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface BottomSheetObservacaoProps {
  isOpen: boolean;
  produtoNome: string;
  observacaoInicial?: string;
  onConfirmar: (observacao: string) => void;
  onClose: () => void;
}

const TAGS_SUGESTOES = [
  'Sem cebola',
  'Sem gelo',
  'Ao ponto',
  'Mal passado',
  'Bem passado',
  'Alérgico',
  'Sem açúcar',
  'Sem maionese',
  'Gelo e limão',
];

const LIMITE_CARACTERES = 240;

export const BottomSheetObservacao: React.FC<BottomSheetObservacaoProps> = ({
  isOpen,
  produtoNome,
  observacaoInicial = '',
  onConfirmar,
  onClose,
}) => {
  const [texto, setTexto] = useState<string>(observacaoInicial);
  const [isAlergia, setIsAlergia] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setTexto(observacaoInicial || '');
      // Se a observação já mencionar alergia, ativa o estado de alergia
      const temAlergia = /alérgico|alergia/i.test(observacaoInicial || '');
      setIsAlergia(temAlergia);
    }
  }, [isOpen, observacaoInicial]);

  if (!isOpen) return null;

  const caracteresRestantes = LIMITE_CARACTERES - texto.length;
  const isLimiteAtingido = texto.length >= LIMITE_CARACTERES;

  const handleTextoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const novoValor = e.target.value.slice(0, LIMITE_CARACTERES);
    setTexto(novoValor);
    if (/alérgico|alergia/i.test(novoValor)) {
      setIsAlergia(true);
    }
  };

  const handleInserirTag = (tag: string) => {
    setTexto((prev) => {
      const textoAtual = prev.trim();
      let resultado = '';
      if (!textoAtual) {
        resultado = tag;
      } else {
        resultado = `${textoAtual}, ${tag}`;
      }
      return resultado.slice(0, LIMITE_CARACTERES);
    });

    if (/alérgico|alergia/i.test(tag)) {
      setIsAlergia(true);
    }
  };

  const handleToggleAlergia = () => {
    const novoEstado = !isAlergia;
    setIsAlergia(novoEstado);
    if (novoEstado && !/alérgico/i.test(texto)) {
      handleInserirTag('Alérgico');
    }
  };

  const handleConfirmar = () => {
    onConfirmar(texto.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-bottomsheet-obs"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-modal border border-border space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual no celular */}
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        {/* Topo: Título e Botão Fechar X */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-text bg-brand-soft px-2.5 py-1 rounded-full inline-block mb-1">
              G04 · Observação e Alergia
            </span>
            <h2 id="titulo-bottomsheet-obs" className="text-lg font-black text-text tracking-tight">
              Personalizar: {produtoNome}
            </h2>
            <p className="text-xs text-text-2">
              Adicione exigências de preparo ou restrições alimentares.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-surface-2 hover:bg-border flex items-center justify-center text-text-2 hover:text-text transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Switch de Alergia Alimentar (DESIGN.md G04) */}
        <div
          onClick={handleToggleAlergia}
          className={cn(
            'p-3 rounded-[18px] border cursor-pointer transition-all flex items-center justify-between min-h-[44px]',
            isAlergia
              ? 'bg-danger-soft border-danger/40 text-danger-text'
              : 'bg-surface-2 border-border text-text'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                isAlergia ? 'bg-danger text-white' : 'bg-surface text-text-2'
              )}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-xs block">Restrição / Alergia Alimentar</span>
              <span className="text-[11px] opacity-80 block">
                Destaca em vermelho no KDS da cozinha
              </span>
            </div>
          </div>

          <div
            className={cn(
              'w-11 h-6 rounded-full p-0.5 transition-colors',
              isAlergia ? 'bg-danger' : 'bg-border'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full bg-white transition-transform shadow-soft',
                isAlergia ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </div>
        </div>

        {/* Tags / Chips Rápidos de Sugestão (EARS-OBS-04) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span className="text-xs font-bold text-text-2">Sugestões rápidas:</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TAGS_SUGESTOES.map((tag) => {
              const isSelected = texto.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleInserirTag(tag)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold transition-all min-h-[36px] flex items-center gap-1 active:scale-95',
                    isSelected
                      ? 'bg-brand text-on-brand shadow-soft'
                      : 'bg-surface border border-border text-text hover:bg-surface-2'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textarea com Contador Regressivo (EARS-OBS-07, EARS-OBS-09) */}
        <div className="space-y-1.5">
          <label htmlFor="input-observacao" className="block text-xs font-bold text-text">
            Observações de Preparo
          </label>
          <div className="relative">
            <textarea
              id="input-observacao"
              rows={3}
              maxLength={LIMITE_CARACTERES}
              value={texto}
              onChange={handleTextoChange}
              placeholder="Ex.: Sem cebola, carne ao ponto, alérgico a amendoim..."
              className={cn(
                'w-full p-3.5 rounded-[18px] bg-surface-2 border text-text text-sm resize-none focus:outline-none transition-all placeholder:text-text-2/60',
                isLimiteAtingido
                  ? 'border-danger focus:ring-1 focus:ring-danger'
                  : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
              )}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] px-1">
            {isLimiteAtingido ? (
              <span className="font-bold text-danger flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Limite máximo de 240 caracteres atingido
              </span>
            ) : (
              <span className="text-text-2">Máximo de 240 caracteres</span>
            )}
            <span
              className={cn(
                'font-bold tabular-nums',
                isLimiteAtingido ? 'text-danger' : 'text-text-2'
              )}
            >
              {caracteresRestantes}/240 caracteres
            </span>
          </div>
        </div>

        {/* Botões de Ação (Confirmar Item e Cancelar / Voltar) */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleConfirmar}
            className="w-full h-12 min-h-[44px] rounded-[18px] bg-brand hover:bg-brand-hover text-on-brand font-black text-sm shadow-soft transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Confirmar Item</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 min-h-[44px] rounded-[16px] bg-surface-2 hover:bg-border text-text font-bold text-xs transition-colors flex items-center justify-center"
          >
            Cancelar / Voltar
          </button>
        </div>
      </div>
    </div>
  );
};
