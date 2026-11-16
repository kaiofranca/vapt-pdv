import React from 'react';
import { Clock } from 'lucide-react';
import { formatCurrency, formatElapsedTime, cn } from '../../../lib/utils';
import type { Comanda } from '../../../types/api';

export interface MesaCardProps {
  mesaNumero: number | string;
  comanda?: Comanda | null;
  garcomNome?: string;
  isSelected?: boolean;
  onAbrirMesa: (numeroMesa: string) => void;
  onVerComanda: (comanda: Comanda) => void;
}

export const MesaCard: React.FC<MesaCardProps> = ({
  mesaNumero,
  comanda,
  garcomNome,
  isSelected = false,
  onAbrirMesa,
  onVerComanda,
}) => {
  const isContaPedida = comanda?.status === 'fechada';
  const isLivre = !comanda || (comanda.status !== 'aberta' && comanda.status !== 'fechada');

  const tempoAberto = formatElapsedTime(comanda?.aberta_em);

  const handleClick = () => {
    if (isLivre) {
      onAbrirMesa(String(mesaNumero));
    } else if (comanda) {
      onVerComanda(comanda);
    }
  };

  if (isLivre) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'bg-surface border-2 border-dashed border-[#8C7A68]/30 hover:border-brand rounded-[20px] p-4 flex flex-col justify-between min-h-[148px] cursor-pointer transition-all active:scale-[0.98] select-none shadow-soft',
          isSelected && 'ring-2 ring-brand border-brand',
        )}
      >
        <div className="flex items-start justify-between">
          <span className="text-lg font-black text-text">Mesa {mesaNumero}</span>
          <span className="bg-success-soft text-success rounded-full px-2.5 py-0.5 text-xs font-bold">
            Livre
          </span>
        </div>

        <div className="text-xs text-text-2 font-medium">4 lugares</div>
      </div>
    );
  }

  if (isContaPedida) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'bg-surface border-2 border-danger rounded-[20px] p-4 flex flex-col justify-between min-h-[148px] cursor-pointer transition-all active:scale-[0.98] select-none shadow-soft',
          isSelected && 'ring-2 ring-danger',
        )}
      >
        <div className="flex items-start justify-between">
          <span className="text-lg font-black text-text">Mesa {mesaNumero}</span>
          <span className="bg-danger-soft text-danger rounded-full px-2.5 py-0.5 text-xs font-bold">
            Conta
          </span>
        </div>

        <div className="space-y-0.5">
          <div className="text-xs font-bold text-text truncate">
            {comanda?.nome_cliente || 'Cliente'} {garcomNome ? `· ${garcomNome}` : ''}
          </div>
          {tempoAberto && (
            <div className="text-[11px] text-text-2 flex items-center gap-1">
              <Clock className="w-3 h-3 text-danger" />
              <span>{tempoAberto}</span>
            </div>
          )}
        </div>

        <div className="text-base font-black text-text">
          {formatCurrency(comanda?.total || comanda?.subtotal || '0.00')}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'bg-surface border border-border border-l-[6px] border-l-brand rounded-[20px] p-4 flex flex-col justify-between min-h-[148px] cursor-pointer transition-all active:scale-[0.98] select-none shadow-soft hover:shadow-card',
        isSelected && 'ring-2 ring-brand',
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-lg font-black text-text">Mesa {mesaNumero}</span>
        <span className="bg-brand-soft text-brand-text rounded-full px-2.5 py-0.5 text-xs font-bold">
          Aberta
        </span>
      </div>

      <div className="space-y-0.5">
        <div className="text-xs font-bold text-text truncate">
          {comanda?.nome_cliente || 'Salão'} {garcomNome ? `· ${garcomNome}` : ''}
        </div>
        {tempoAberto && (
          <div className="text-[11px] text-text-2 flex items-center gap-1">
            <Clock className="w-3 h-3 text-text-2" />
            <span>{tempoAberto}</span>
          </div>
        )}
      </div>

      <div className="text-base font-black text-text">
        {formatCurrency(comanda?.subtotal || comanda?.total || '0.00')}
      </div>
    </div>
  );
};
