import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Sandwich,
  Drumstick,
  IceCreamCone,
  CupSoda,
  Package,
  Utensils,
  X,
  AlertCircle,
} from 'lucide-react';
import type { Produto } from '../../../types/api';
import { formatCurrency } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';

export interface CatalogoGridProps {
  produtos: Produto[];
  isLoading?: boolean;
  onLancarItem: (produto: Produto) => void;
  buscaInputRef?: React.RefObject<HTMLInputElement | null>;
  buscaValor: string;
  onBuscaChange: (valor: string) => void;
  comandaAbertaId?: number | null;
}

export const CatalogoGrid: React.FC<CatalogoGridProps> = ({
  produtos,
  isLoading = false,
  onLancarItem,
  buscaInputRef,
  buscaValor,
  onBuscaChange,
  comandaAbertaId,
}) => {
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todos');
  const [ultimoCliqueTempo, setUltimoCliqueTempo] = useState<number>(0);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = buscaInputRef || internalInputRef;

  const categorias = useMemo(() => {
    const cats = new Set<string>();
    cats.add('todos');
    produtos.forEach((p) => {
      if (p.categoria) {
        cats.add(p.categoria.toLowerCase());
      }
    });
    return Array.from(cats);
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchCategoria =
        categoriaAtiva === 'todos' ||
        (p.categoria && p.categoria.toLowerCase() === categoriaAtiva);

      const matchBusca =
        !buscaValor.trim() ||
        p.nome.toLowerCase().includes(buscaValor.toLowerCase()) ||
        String(p.id) === buscaValor.trim();

      return matchCategoria && matchBusca;
    });
  }, [produtos, categoriaAtiva, buscaValor]);

  const getCategoriaConfig = (categoria: string) => {
    const cat = categoria?.toLowerCase() || '';
    if (cat.includes('lanche') || cat.includes('burger')) {
      return {
        bgClass: 'bg-tint-beer',
        textClass: 'text-brand-text',
        Icon: Sandwich,
      };
    }
    if (cat.includes('porç') || cat.includes('petisco')) {
      return {
        bgClass: 'bg-tint-snack',
        textClass: 'text-success',
        Icon: Drumstick,
      };
    }
    if (cat.includes('sobremesa') || cat.includes('doce')) {
      return {
        bgClass: 'bg-tint-dessert',
        textClass: 'text-text-2',
        Icon: IceCreamCone,
      };
    }
    if (cat.includes('bebida') || cat.includes('chopp') || cat.includes('suco') || cat.includes('refrigerante')) {
      return {
        bgClass: 'bg-tint-drink',
        textClass: 'text-danger',
        Icon: CupSoda,
      };
    }
    if (cat.includes('combo')) {
      return {
        bgClass: 'bg-tint-beer',
        textClass: 'text-brand-text',
        Icon: Package,
      };
    }
    return {
      bgClass: 'bg-surface-2',
      textClass: 'text-text-2',
      Icon: Utensils,
    };
  };

  const handleItemClick = (produto: Produto) => {
    if (produto.estoque <= 0 || !produto.ativo) {
      return;
    }
    const agora = Date.now();
    if (agora - ultimoCliqueTempo < 250) {
      return;
    }
    setUltimoCliqueTempo(agora);
    onLancarItem(produto);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg p-4 sm:p-6 gap-4">
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={buscaValor}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar item ou ler código... (F2)"
              className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-input bg-surface border border-border text-text placeholder:text-text-2/70 focus:outline-none focus:border-text focus:ring-1 focus:ring-text text-sm font-medium shadow-soft transition-colors"
            />
            {buscaValor && (
              <button
                onClick={() => onBuscaChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text p-1"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <span className="hidden lg:inline-flex items-center text-xs text-text-2 font-medium">
            <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[11px] font-bold text-text mr-1">
              F2
            </kbd>
            para focar
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
          {categorias.map((cat) => {
            const isAtiva = categoriaAtiva === cat;
            const rotulo =
              cat === 'todos'
                ? 'Todos'
                : cat.charAt(0).toUpperCase() + cat.slice(1);

            return (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isAtiva
                    ? 'bg-brand text-on-brand shadow-soft'
                    : 'bg-surface text-text-2 border border-border hover:bg-surface-2'
                }`}
                aria-pressed={isAtiva}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-card bg-surface border border-border p-3.5 h-[170px] animate-pulse flex flex-col justify-between"
              >
                <div className="w-16 h-16 rounded-input bg-surface-2 mx-auto" />
                <div className="space-y-1.5 mt-2">
                  <div className="h-4 bg-surface-2 rounded w-3/4 mx-auto" />
                  <div className="h-4 bg-surface-2 rounded w-1/2 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : produtosFiltrados.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-4">
            {produtosFiltrados.map((prod) => {
              const { bgClass, textClass, Icon } = getCategoriaConfig(prod.categoria);
              const isEsgotado = prod.estoque <= 0 || !prod.ativo;

              return (
                <button
                  key={prod.id}
                  onClick={() => handleItemClick(prod)}
                  disabled={isEsgotado}
                  aria-disabled={isEsgotado}
                  className={`relative rounded-card bg-surface border border-border p-3 sm:p-4 text-center transition-all duration-150 flex flex-col items-center justify-between min-h-[168px] select-none text-left w-full group ${
                    isEsgotado
                      ? 'opacity-55 cursor-not-allowed bg-surface-2/40'
                      : 'hover:border-brand-edge hover:shadow-card active:scale-[0.98] cursor-pointer'
                  }`}
                  title={
                    isEsgotado
                      ? `${prod.nome} (Esgotado)`
                      : comandaAbertaId
                      ? `Lançar ${prod.nome} na comanda #${comandaAbertaId}`
                      : `Selecione ou abra uma mesa para lançar ${prod.nome}`
                  }
                >
                  {isEsgotado && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge variant="esgotado" size="sm">
                        Esgotado
                      </Badge>
                    </div>
                  )}

                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-input ${bgClass} flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 mb-2`}
                  >
                    <Icon className={`w-8 h-8 sm:w-9 sm:h-9 ${textClass}`} />
                  </div>

                  <div className="w-full text-center mb-1">
                    <span
                      className="text-xs sm:text-[13px] font-bold text-text line-clamp-2 leading-snug block"
                      title={prod.nome}
                    >
                      {prod.nome}
                    </span>
                    <span className="text-[11px] text-text-2 capitalize">
                      {prod.categoria || 'Geral'}
                    </span>
                  </div>

                  <div className="w-full text-center pt-1 border-t border-border/40">
                    <span className="font-extrabold text-sm sm:text-base text-text tabular-nums">
                      {formatCurrency(prod.preco)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-text-2">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-3">
              <AlertCircle className="w-8 h-8 text-text-2/70" />
            </div>
            <h3 className="font-bold text-base text-text mb-1">Nenhum produto encontrado</h3>
            <p className="text-xs text-text-2 max-w-xs mb-4">
              Não encontramos nenhum item com o termo &ldquo;{buscaValor}&rdquo; nesta categoria.
            </p>
            {buscaValor && (
              <button
                onClick={() => onBuscaChange('')}
                className="px-4 py-2 rounded-btn bg-surface-2 border border-border text-xs font-bold text-text hover:bg-border transition-colors"
              >
                Limpar Busca
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
