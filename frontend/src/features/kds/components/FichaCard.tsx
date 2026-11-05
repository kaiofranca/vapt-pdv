import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  User,
  Wine,
  Sparkles,
} from 'lucide-react';
import type { FichaKds, StatusFichaKds } from '../types';

interface FichaCardProps {
  ficha: FichaKds;
  onAtualizarStatus: (id: number, novoStatus: StatusFichaKds) => void;
  isLoading?: boolean;
}

export const FichaCard: React.FC<FichaCardProps> = ({
  ficha,
  onAtualizarStatus,
  isLoading,
}) => {
  const [segundosDecorridos, setSegundosDecorridos] = useState<number>(() => {
    if (ficha.tempo_decorrido_segundos !== undefined) {
      return ficha.tempo_decorrido_segundos;
    }
    const recebidoEm = new Date(ficha.recebido_em).getTime();
    return Math.max(0, Math.floor((Date.now() - recebidoEm) / 1000));
  });

  // Cronômetro em tempo real cliente-side atualizado a cada segundo
  useEffect(() => {
    const recebidoEm = new Date(ficha.recebido_em).getTime();
    const interval = setInterval(() => {
      const segundos = Math.max(0, Math.floor((Date.now() - recebidoEm) / 1000));
      setSegundosDecorridos(segundos);
    }, 1000);
    return () => clearInterval(interval);
  }, [ficha.recebido_em]);

  // Formatação MM:SS
  const tempoFormatado = useMemo(() => {
    const minutos = Math.floor(segundosDecorridos / 60);
    const segundos = segundosDecorridos % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }, [segundosDecorridos]);

  // Classificação SLA:
  // Normal: < 10 min (< 600s) -> Verde
  // Atenção: 10 a 15 min (600s a 899s) -> Amarelo
  // Atrasado: >= 15 min (>= 900s) -> Vermelho
  const slaNivel = useMemo<'normal' | 'atencao' | 'atrasado'>(() => {
    if (segundosDecorridos >= 900) return 'atrasado';
    if (segundosDecorridos >= 600) return 'atencao';
    return 'normal';
  }, [segundosDecorridos]);

  const borderStyles = {
    normal: 'border-emerald-500/70 shadow-emerald-500/5',
    atencao: 'border-amber-500 shadow-amber-500/10',
    atrasado: 'border-rose-600 shadow-rose-600/20 ring-2 ring-rose-500/40 animate-pulse',
  };

  const timerBadgeStyles = {
    normal: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    atencao: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    atrasado: 'bg-rose-500/30 text-rose-200 border-rose-500/50 font-black',
  };

  const handleAvancarStatus = () => {
    if (ficha.status === 'recebido') {
      onAtualizarStatus(ficha.id, 'em_preparo');
    } else if (ficha.status === 'em_preparo') {
      onAtualizarStatus(ficha.id, 'pronto');
    } else if (ficha.status === 'pronto') {
      onAtualizarStatus(ficha.id, 'entregue');
    }
  };

  return (
    <div
      className={`bg-[#2B2019] rounded-[24px] border-2 ${borderStyles[slaNivel]} p-5 flex flex-col justify-between shadow-xl transition-all duration-300 select-none min-h-[300px]`}
    >
      {/* Topo do Ticket: Mesa + SLA Timer + Setor */}
      <div>
        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#43342A]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl font-black text-[#FAF3EB] tracking-tight">
              MESA {String(ficha.mesa).padStart(2, '0')}
            </span>
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/10 text-[#D4C3B3] border border-white/15">
              #{ficha.id}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-mono text-sm font-bold ${timerBadgeStyles[slaNivel]}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{tempoFormatado}</span>
          </div>
        </div>

        {/* Sub-topo: Garçom e Estação */}
        <div className="flex items-center justify-between text-xs text-[#A89887] pt-2.5">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span className="font-semibold">{ficha.garcom_nome || 'Salão'}</span>
          </div>

          <div className="flex items-center gap-1">
            {ficha.setor === 'bar' ? (
              <span className="flex items-center gap-1 text-sky-400 font-bold text-[11px]">
                <Wine className="w-3 h-3" /> Bar
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                <Flame className="w-3 h-3" /> Cozinha
              </span>
            )}
          </div>
        </div>

        {/* Alerta de Atraso se excedeu 15 minutos */}
        {slaNivel === 'atrasado' && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500 text-rose-200 text-xs font-black flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>ATRASADO ({Math.floor(segundosDecorridos / 60)} min)</span>
          </div>
        )}

        {/* Corpo do Pedido: Quantidade e Produto em Alta Legibilidade */}
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-amber-400 font-mono">
              {ficha.quantidade}x
            </span>
            <span className="text-xl font-extrabold text-white leading-tight">
              {ficha.nome_produto}
            </span>
          </div>

          {/* Destaque Crítico de Observação / Alergias */}
          {ficha.observacao && (
            <div className="p-3 rounded-2xl bg-rose-500/20 border-2 border-rose-500/60 text-rose-200 shadow-sm mt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-300 mb-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Observação / Alergia:</span>
              </div>
              <p className="text-sm font-bold leading-snug uppercase">
                {ficha.observacao}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé: Status Atual e Botão de Ação Touch (mínimo 56x56px) */}
      <div className="pt-5 mt-4 border-t border-[#43342A]">
        {ficha.status === 'recebido' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAvancarStatus}
            className="w-full h-14 min-h-[56px] rounded-2xl bg-amber-500 hover:bg-amber-400 text-[#1B140F] font-black text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Flame className="w-5 h-5 fill-current" />
            <span>INICIAR PREPARO</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {ficha.status === 'em_preparo' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAvancarStatus}
            className="w-full h-14 min-h-[56px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#1B140F] font-black text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>MARCAR PRONTO</span>
            <Sparkles className="w-4 h-4" />
          </button>
        )}

        {ficha.status === 'pronto' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAvancarStatus}
            className="w-full h-14 min-h-[56px] rounded-2xl bg-[#3D2D23] hover:bg-[#4E3B2E] text-white font-extrabold text-sm tracking-wide border border-white/20 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>ENTREGUE AO SALÃO</span>
          </button>
        )}
      </div>
    </div>
  );
};
