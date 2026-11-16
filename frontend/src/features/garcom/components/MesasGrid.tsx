import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { MesaCard } from './MesaCard';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { LogoMark } from '../../../components/ui/Logo';
import type { Comanda, Usuario } from '../../../types/api';

export type FiltroMesa = 'todas' | 'livres' | 'abertas' | 'minhas' | 'contas';

export interface MesasGridProps {
  comandas: Comanda[];
  nomeGarcom?: string;
  garcomLogadoId?: number | null;
  garcons?: Usuario[];
  totalMesasSalao?: number;
  onAbrirMesa: (numeroMesa: string) => void;
  onVerComanda: (comanda: Comanda) => void;
}

export const MesasGrid: React.FC<MesasGridProps> = ({
  comandas,
  nomeGarcom = 'Garçom',
  garcomLogadoId,
  garcons = [],
  totalMesasSalao = 12,
  onAbrirMesa,
  onVerComanda,
}) => {
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroMesa>('todas');

  const garcomMap = useMemo(() => {
    const map = new Map<number, string>();
    garcons.forEach((g) => map.set(g.id, g.nome));
    return map;
  }, [garcons]);

  const todasMesas = useMemo(() => {
    const lista: string[] = [];
    for (let i = 1; i <= totalMesasSalao; i++) {
      lista.push(String(i));
    }
    comandas.forEach((c) => {
      if (!lista.includes(String(c.mesa))) {
        lista.push(String(c.mesa));
      }
    });
    return lista;
  }, [totalMesasSalao, comandas]);

  const comandaPorMesa = useMemo(() => {
    const map = new Map<string, Comanda>();
    comandas.forEach((cmd) => {
      if (cmd.status === 'aberta' || cmd.status === 'fechada') {
        map.set(String(cmd.mesa), cmd);
      }
    });
    return map;
  }, [comandas]);

  const contadores = useMemo(() => {
    let livres = 0;
    let abertas = 0;
    let minhas = 0;
    let contas = 0;

    todasMesas.forEach((mesaNum) => {
      const cmd = comandaPorMesa.get(mesaNum);
      if (!cmd) {
        livres++;
      } else if (cmd.status === 'aberta') {
        abertas++;
        if (garcomLogadoId && cmd.garcom_id === garcomLogadoId) {
          minhas++;
        }
      } else if (cmd.status === 'fechada') {
        contas++;
        if (garcomLogadoId && cmd.garcom_id === garcomLogadoId) {
          minhas++;
        }
      }
    });

    return {
      todas: todasMesas.length,
      livres,
      abertas,
      minhas,
      contas,
    };
  }, [todasMesas, comandaPorMesa, garcomLogadoId]);

  const mesasFiltradas = useMemo(() => {
    return todasMesas.filter((mesaNum) => {
      const cmd = comandaPorMesa.get(mesaNum);
      if (filtroAtivo === 'todas') return true;
      if (filtroAtivo === 'livres') return !cmd;
      if (filtroAtivo === 'abertas') return cmd?.status === 'aberta';
      if (filtroAtivo === 'contas') return cmd?.status === 'fechada';
      if (filtroAtivo === 'minhas') {
        return cmd && garcomLogadoId && cmd.garcom_id === garcomLogadoId;
      }
      return true;
    });
  }, [todasMesas, comandaPorMesa, filtroAtivo, garcomLogadoId]);

  return (
    <div className="relative pb-24">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <LogoMark size={40} className="shrink-0" />
          <div>
            <h1 className="text-2xl font-black text-text tracking-tight leading-none">Salão</h1>
            <p className="text-xs text-text-2 mt-1">Olá, {nomeGarcom}</p>
          </div>
        </div>

        <ThemeToggle variante="icon" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => setFiltroAtivo('todas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            filtroAtivo === 'todas'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          <span>Todas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              filtroAtivo === 'todas' ? 'bg-black/15 text-on-brand' : 'bg-surface-2 text-text-2'
            }`}
          >
            {contadores.todas}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroAtivo('livres')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            filtroAtivo === 'livres'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          <span>Livres</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              filtroAtivo === 'livres' ? 'bg-black/15 text-on-brand' : 'bg-surface-2 text-text-2'
            }`}
          >
            {contadores.livres}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroAtivo('abertas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            filtroAtivo === 'abertas'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          <span>Abertas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              filtroAtivo === 'abertas' ? 'bg-black/15 text-on-brand' : 'bg-surface-2 text-text-2'
            }`}
          >
            {contadores.abertas}
          </span>
        </button>

        {contadores.contas > 0 && (
          <button
            type="button"
            onClick={() => setFiltroAtivo('contas')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
              filtroAtivo === 'contas'
                ? 'bg-danger text-white shadow-soft'
                : 'bg-surface border border-danger/40 text-danger hover:bg-danger-soft'
            }`}
          >
            <span>Conta pedida</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {contadores.contas}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setFiltroAtivo('minhas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            filtroAtivo === 'minhas'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          <span>Minhas</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              filtroAtivo === 'minhas' ? 'bg-black/15 text-on-brand' : 'bg-surface-2 text-text-2'
            }`}
          >
            {contadores.minhas}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {mesasFiltradas.map((mesaNum) => {
          const comanda = comandaPorMesa.get(mesaNum);
          const garcomNome = comanda ? garcomMap.get(comanda.garcom_id) : undefined;

          return (
            <MesaCard
              key={mesaNum}
              mesaNumero={mesaNum}
              comanda={comanda}
              garcomNome={garcomNome}
              onAbrirMesa={onAbrirMesa}
              onVerComanda={onVerComanda}
            />
          );
        })}
      </div>

      <div className="fixed bottom-20 right-4 sm:right-6 z-30">
        <button
          type="button"
          onClick={() => onAbrirMesa('')}
          className="bg-brand hover:bg-brand-hover text-on-brand font-black text-sm px-6 py-4 rounded-full shadow-modal flex items-center gap-2 transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Abrir mesa</span>
        </button>
      </div>
    </div>
  );
};
