import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, Flame, LogOut, CheckCircle2, AlertTriangle, Wine } from 'lucide-react';
import { useSessionStore } from '../../../stores/useSessionStore';
import type { EstacaoFiltro } from '../types';

interface KdsHeaderProps {
  estacaoAtiva: EstacaoFiltro;
  onSelecionarEstacao: (estacao: EstacaoFiltro) => void;
  resumo: {
    recebido?: number;
    em_preparo?: number;
    pronto?: number;
    atrasadas?: number;
  };
}

export const KdsHeader: React.FC<KdsHeaderProps> = ({
  estacaoAtiva,
  onSelecionarEstacao,
  resumo,
}) => {
  const { nomeOperador, logout } = useSessionStore();
  const [horaAtual, setHoraAtual] = useState<string>('');

  useEffect(() => {
    const atualizarRelogio = () => {
      const agora = new Date();
      setHoraAtual(
        agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    atualizarRelogio();
    const interval = setInterval(atualizarRelogio, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#231A14] border-b border-[#3D2D23] px-6 py-3.5 text-white flex flex-wrap items-center justify-between gap-4 select-none shrink-0">
      {/* Esquerda: Identidade & Relógio */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-soft">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-[#FAF3EB]">
                Vapt<span className="text-amber-400">KDS</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Painel TV
              </span>
            </div>
            <p className="text-xs text-[#A89887]">
              {nomeOperador || 'Cozinha'} · Sistema Distribuído
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-[#3D2D23] text-sm font-mono text-[#D4C3B3]">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="font-bold tracking-wider">{horaAtual || '--:--:--'}</span>
        </div>
      </div>

      {/* Centro: Filtros de Estação */}
      <div className="flex items-center gap-1.5 bg-[#1B140F] p-1.5 rounded-2xl border border-[#3D2D23]">
        <button
          type="button"
          onClick={() => onSelecionarEstacao('todas')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            estacaoAtiva === 'todas'
              ? 'bg-amber-500 text-[#1B140F] shadow-sm font-black'
              : 'text-[#D4C3B3] hover:text-white hover:bg-white/5'
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => onSelecionarEstacao('cozinha')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            estacaoAtiva === 'cozinha'
              ? 'bg-amber-500 text-[#1B140F] shadow-sm font-black'
              : 'text-[#D4C3B3] hover:text-white hover:bg-white/5'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Cozinha</span>
        </button>
        <button
          type="button"
          onClick={() => onSelecionarEstacao('bar')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            estacaoAtiva === 'bar'
              ? 'bg-amber-500 text-[#1B140F] shadow-sm font-black'
              : 'text-[#D4C3B3] hover:text-white hover:bg-white/5'
          }`}
        >
          <Wine className="w-3.5 h-3.5" />
          <span>Bar</span>
        </button>
      </div>

      {/* Direita: Contadores de SLA & Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-[#D4C3B3]">Recebidos:</span>
            <span className="font-black text-white">{resumo.recebido || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            <Flame className="w-3.5 h-3.5" />
            <span>Preparo:</span>
            <span className="font-black text-amber-200">{resumo.em_preparo || 0}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Prontos:</span>
            <span className="font-black text-emerald-200">{resumo.pronto || 0}</span>
          </div>

          {(resumo.atrasadas ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Atrasados:</span>
              <span className="font-black text-rose-100">{resumo.atrasadas}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-bold text-[#D4C3B3] hover:text-rose-200 transition-all active:scale-95"
          title="Sair / Trocar Operador"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};
