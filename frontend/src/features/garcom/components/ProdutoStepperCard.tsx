import React from 'react';
import { Minus, Plus, Utensils, Beer, Coffee, IceCream, Pizza, Pencil, FileText } from 'lucide-react';
import { formatCurrency, cn } from '../../../lib/utils';
import type { Produto } from '../../../types/api';

export interface ProdutoStepperCardProps {
  produto: Produto;
  quantidade: number;
  observacao?: string;
  onIncrementar: () => void;
  onDecrementar: () => void;
  onAbrirObservacao?: () => void;
}

export const ProdutoStepperCard: React.FC<ProdutoStepperCardProps> = ({
  produto,
  quantidade,
  observacao,
  onIncrementar,
  onDecrementar,
  onAbrirObservacao,
}) => {
  const isEsgotado = !produto.ativo || produto.estoque <= 0;

  // Cor do tile tintado e ícone de acordo com a categoria
  const obterEstiloTile = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('bebida') || c.includes('chopp') || c.includes('cerveja')) {
      return { bg: 'bg-tint-beer', icon: Beer };
    }
    if (c.includes('porção') || c.includes('porcao') || c.includes('frita') || c.includes('petisco')) {
      return { bg: 'bg-tint-snack', icon: Pizza };
    }
    if (c.includes('sobremesa') || c.includes('doce') || c.includes('sorvete')) {
      return { bg: 'bg-tint-dessert', icon: IceCream };
    }
    if (c.includes('cafe') || c.includes('café')) {
      return { bg: 'bg-tint-drink', icon: Coffee };
    }
    // Padrão / Lanches
    return { bg: 'bg-tint-beer', icon: Utensils };
  };

  const tile = obterEstiloTile(produto.categoria);
  const IconeCategoria = tile.icon;

  return (
    <div
      className={cn(
        'p-3 sm:p-4 rounded-[20px] bg-surface border border-border flex items-center justify-between gap-3 shadow-soft transition-all select-none',
        quantidade > 0 && 'border-brand ring-1 ring-brand/40',
        isEsgotado && 'opacity-50 pointer-events-none bg-surface-2',
      )}
    >
      {/* Lado Esquerdo: Tile Tintado + Informações (Fiel a G03) */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={cn(
            'w-14 h-14 rounded-[16px] flex items-center justify-center shrink-0 shadow-soft',
            tile.bg,
          )}
        >
          <IconeCategoria className="w-6 h-6 text-text" />
        </div>

        <div className="min-w-0 pr-1">
          <h4 className="font-extrabold text-sm text-text truncate leading-snug">
            {produto.nome}
          </h4>
          <p className="text-[11px] text-text-2 truncate capitalize">
            {produto.categoria}
          </p>
          <div className="text-sm font-black text-text mt-0.5">
            {formatCurrency(produto.preco)}
          </div>
          {observacao && (
            <p className="text-[11px] text-brand-text italic truncate flex items-center gap-1 mt-1 font-medium max-w-[180px] sm:max-w-[220px]" title={observacao}>
              <FileText className="w-3 h-3 text-brand shrink-0" />
              <span className="truncate">{observacao}</span>
            </p>
          )}
        </div>
      </div>

      {/* Lado Direito: Ações (Observação + Stepper Âmbar ou Botão [+] Redondo) */}
      <div className="shrink-0 flex items-center gap-2">
        {!isEsgotado && onAbrirObservacao && (
          <button
            type="button"
            onClick={onAbrirObservacao}
            aria-label={observacao ? 'Editar observação' : 'Adicionar observação'}
            className={cn(
              'w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-all shadow-soft active:scale-95',
              observacao
                ? 'bg-brand-soft border-brand text-brand-text ring-1 ring-brand/30'
                : 'bg-surface border-border text-text-2 hover:text-text hover:bg-surface-2'
            )}
            title={observacao ? `Observação: ${observacao}` : 'Adicionar observação'}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {isEsgotado ? (
          <span className="text-[11px] font-bold text-danger bg-danger-soft px-2 py-1 rounded-full">
            Esgotado
          </span>
        ) : quantidade > 0 ? (
          <div className="flex items-center gap-2.5 bg-brand-soft px-2.5 py-1.5 rounded-full border border-brand/30">
            <button
              type="button"
              onClick={onDecrementar}
              className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
              aria-label="Diminuir"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <span className="font-black text-sm text-text tabular-nums min-w-[16px] text-center">
              {quantidade}
            </span>

            <button
              type="button"
              onClick={onIncrementar}
              className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
              aria-label="Aumentar"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onIncrementar}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-border bg-surface hover:bg-surface-2 flex items-center justify-center text-text active:scale-95 transition-all shadow-soft"
            aria-label="Adicionar item"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
