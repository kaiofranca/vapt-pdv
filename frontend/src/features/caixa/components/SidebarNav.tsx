import React from 'react';
import {
  ShoppingCart,
  LayoutGrid,
  ClipboardList,
  Wallet,
  Smartphone,
  LogOut,
  User,
} from 'lucide-react';
import { LogoMark } from '../../../components/ui/Logo';
import { useSessionStore } from '../../../stores/useSessionStore';

export type AbaNavegacaoCaixa = 'venda' | 'mesas' | 'pedidos' | 'receber';

export interface SidebarNavProps {
  abaAtiva?: AbaNavegacaoCaixa | 'caixa';
  onAbaChange?: (aba: AbaNavegacaoCaixa) => void;
  contasPedidasCount?: number;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  abaAtiva = 'venda',
  onAbaChange,
  contasPedidasCount = 0,
}) => {
  const { nomeOperador, perfilAtivo, setModo, logout } = useSessionStore();

  const abaNormalizada: AbaNavegacaoCaixa =
    abaAtiva === 'caixa' ? 'receber' : (abaAtiva as AbaNavegacaoCaixa);

  const navItems: {
    id: AbaNavegacaoCaixa;
    label: string;
    icon: React.ElementType;
    badgeCount?: number;
  }[] = [
    {
      id: 'venda',
      label: 'Venda',
      icon: ShoppingCart,
    },
    {
      id: 'mesas',
      label: 'Mesas',
      icon: LayoutGrid,
    },
    {
      id: 'pedidos',
      label: 'Pedidos',
      icon: ClipboardList,
    },
    {
      id: 'receber',
      label: 'Receber',
      icon: Wallet,
      badgeCount: contasPedidasCount,
    },
  ];

  return (
    <aside
      className="w-[88px] min-w-[88px] max-w-[88px] h-full bg-nav flex flex-col items-center justify-between py-4 select-none border-r border-[#43342A] z-20 shrink-0"
      aria-label="Navegação do Caixa"
    >
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={() => onAbaChange?.('venda')}
          className="rounded-[14px] shadow-soft hover:opacity-95 transition-transform active:scale-95"
          title="VaptPDV — Início / Venda"
          aria-label="VaptPDV Início"
        >
          <LogoMark size={48} />
        </button>

        <nav className="flex flex-col items-center gap-2 mt-2 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isAtivo = abaNormalizada === item.id;
            const temBadge = (item.badgeCount ?? 0) > 0;

            return (
              <button
                key={item.id}
                onClick={() => onAbaChange?.(item.id)}
                className={`w-full py-2.5 px-1 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all relative ${
                  isAtivo
                    ? 'bg-[#523C2E] text-[#F6EEE4] shadow-sm font-bold'
                    : 'text-[#C9B8A6] hover:bg-[#523C2E]/50 hover:text-[#F6EEE4]'
                }`}
                aria-current={isAtivo ? 'page' : undefined}
                title={item.label}
              >
                {temBadge && (
                  <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-danger text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {item.badgeCount}
                  </span>
                )}
                <Icon
                  className={`w-5 h-5 ${
                    isAtivo ? 'text-brand' : temBadge ? 'text-danger' : 'text-[#C9B8A6]'
                  }`}
                />
                <span className="text-[11px] leading-tight tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col items-center gap-3 w-full px-2">
        <button
          onClick={() => setModo('garcom')}
          className="w-full py-2 px-1 rounded-[14px] flex flex-col items-center justify-center gap-1 text-[#C9B8A6] hover:bg-[#523C2E]/60 hover:text-[#F6EEE4] transition-colors"
          title="Alternar para Modo Garçom (PWA)"
        >
          <Smartphone className="w-5 h-5 text-[#C9B8A6]" />
          <span className="text-[10px] leading-tight text-center">Garçom</span>
        </button>

        <div className="w-8 h-px bg-[#43342A] my-1" />

        <div
          className="w-10 h-10 rounded-full bg-[#523C2E] border border-[#8F7B69]/40 flex items-center justify-center text-[#F6EEE4] font-bold text-xs shadow-soft relative group cursor-pointer"
          title={`${nomeOperador} (${perfilAtivo || 'Operador'})`}
        >
          <User className="w-4 h-4 text-brand" />
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-btn text-[#C9B8A6] hover:text-danger-soft hover:bg-danger/20 transition-colors"
          title="Trocar Operador / Ir para Login"
          aria-label="Sair / Trocar Operador"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
