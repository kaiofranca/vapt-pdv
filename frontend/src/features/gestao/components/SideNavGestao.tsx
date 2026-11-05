import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import { LogoMark } from '../../../components/ui/Logo';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { useSessionStore } from '../../../stores/useSessionStore';

export type AbaNavegacaoGestao = 'visao-geral' | 'curva-abc' | 'garcons' | 'estoque';

export interface SideNavGestaoProps {
  abaAtiva: AbaNavegacaoGestao;
  onAbaChange: (aba: AbaNavegacaoGestao) => void;
  onAbrirExportacao: () => void;
  totalAlertasEstoque?: number;
}

export const SideNavGestao: React.FC<SideNavGestaoProps> = ({
  abaAtiva,
  onAbaChange,
  onAbrirExportacao,
  totalAlertasEstoque = 0,
}) => {
  const { nomeOperador, logout } = useSessionStore();

  const obterIniciais = (nome: string): string => {
    if (!nome) return 'GE';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].slice(0, 2).toUpperCase();
  };

  const navItems: {
    id: AbaNavegacaoGestao;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    badgeCount?: number;
  }[] = [
    {
      id: 'visao-geral',
      label: 'Visão Geral',
      sublabel: 'Dashboard M01',
      icon: LayoutDashboard,
    },
    {
      id: 'curva-abc',
      label: 'Curva ABC',
      sublabel: 'Pareto 80/15/5 M10',
      icon: TrendingUp,
    },
    {
      id: 'garcons',
      label: 'Garçons',
      sublabel: 'Produtividade M11',
      icon: Users,
    },
    {
      id: 'estoque',
      label: 'Estoque',
      sublabel: 'Alertas M05',
      icon: Package,
      badgeCount: totalAlertasEstoque,
    },
  ];

  return (
    <aside
      className="w-[260px] min-w-[260px] max-w-[260px] h-full bg-nav text-white flex flex-col justify-between p-4 select-none border-r border-[#43342A] shrink-0 z-20"
      aria-label="Navegação da Gestão"
    >
      <div className="flex flex-col gap-6">
        {/* Topo: Logotipo VaptPDV + Indicador de Modo */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="rounded-[14px] shadow-soft">
            <LogoMark size={40} />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-[#F6EEE4] leading-tight">
              Vapt<span className="text-brand">PDV</span>
            </div>
            <div className="text-[11px] text-[#C9B8A6] font-medium tracking-wide">
              Gestão Executiva &amp; BI
            </div>
          </div>
        </div>

        {/* Lista de Navegação Principal */}
        <nav className="flex flex-col gap-1.5" aria-label="Abas de Gestão">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isAtivo = abaAtiva === item.id;
            const temAlerta = (item.badgeCount ?? 0) > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onAbaChange(item.id)}
                aria-label={item.label}
                aria-current={isAtivo ? 'page' : undefined}
                className={`w-full px-3.5 py-3 min-h-[44px] rounded-[14px] flex items-center justify-between text-left transition-all ${
                  isAtivo
                    ? 'bg-[#523C2E] text-[#F6EEE4] font-bold shadow-soft'
                    : 'text-[#C9B8A6] hover:bg-[#523C2E]/40 hover:text-[#F6EEE4]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isAtivo ? 'text-brand' : 'text-[#C9B8A6]'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-sm block truncate leading-tight">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-[#C9B8A6]/70 block truncate">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                {temAlerta && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-danger text-white text-[10px] font-black shrink-0 animate-pulse">
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Botão de Ação Rápida: Exportar Relatórios (M15) */}
          <button
            type="button"
            onClick={onAbrirExportacao}
            aria-label="Exportar relatórios gerenciais em CSV ou JSON"
            className="w-full mt-2 px-3.5 py-3 min-h-[44px] rounded-[14px] flex items-center justify-between text-left border border-[#8C7A68]/40 hover:border-brand/80 text-[#F6EEE4] bg-[#2A201A]/60 hover:bg-[#523C2E]/60 transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileSpreadsheet className="w-5 h-5 text-brand shrink-0 group-hover:scale-105 transition-transform" />
              <div className="min-w-0">
                <span className="text-sm font-bold block truncate leading-tight">
                  Exportar Dados
                </span>
                <span className="text-[10px] text-[#C9B8A6]/70 block truncate">
                  CSV / JSON · M15
                </span>
              </div>
            </div>
          </button>
        </nav>
      </div>

      {/* Rodapé: Operador Logado + Troca/Sair + Tema */}
      <div className="pt-4 border-t border-[#43342A] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-brand text-on-brand font-black text-xs flex items-center justify-center shrink-0 shadow-soft">
              {obterIniciais(nomeOperador)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#F6EEE4] truncate leading-tight">
                {nomeOperador}
              </div>
              <div className="text-[10px] text-[#C9B8A6] uppercase tracking-wider font-semibold">
                Gerente
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[10px] text-[#C9B8A6] hover:text-danger hover:bg-danger/20 transition-all shrink-0"
            title="Alternar operador / Sair"
            aria-label="Sair da sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-[#C9B8A6]">
          <span>Tema da interface</span>
          <ThemeToggle variante="icon" />
        </div>
      </div>
    </aside>
  );
};
