import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';

export interface ThemeToggleProps {
  variante?: 'pill' | 'icon';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variante = 'pill', className = '' }) => {
  const { tema, alternarTema } = useThemeStore();
  const escuro = tema === 'escuro';
  const Icone = escuro ? Sun : Moon;
  const rotulo = escuro ? 'Tema claro' : 'Tema escuro';

  return (
    <button
      type="button"
      onClick={alternarTema}
      title={`Alternar para ${rotulo.toLowerCase()}`}
      aria-label={`Alternar para ${rotulo.toLowerCase()}`}
      aria-pressed={escuro}
      className={`rounded-full border border-border bg-surface hover:bg-surface-2 text-text flex items-center justify-center gap-2 shadow-soft transition-all active:scale-95 ${
        variante === 'pill' ? 'px-4 py-2 min-h-[44px] text-xs font-semibold' : 'w-11 h-11 min-w-[44px] min-h-[44px]'
      } ${className}`}
    >
      <Icone className="w-4 h-4 text-brand-text" />
      {variante === 'pill' && <span>{rotulo}</span>}
    </button>
  );
};
