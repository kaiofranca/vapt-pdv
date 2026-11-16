import React, { useState, useMemo } from 'react';
import {
  Plus,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShoppingCart,
  Ban,
} from 'lucide-react';
import type { Comanda, Usuario } from '../../../types/api';
import { formatCurrency, formatElapsedTime } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export type FiltroMesaCaixa = 'todas' | 'livres' | 'abertas' | 'contas';

export interface MesasCaixaViewProps {
  comandas: Comanda[];
  garcons?: Usuario[];
  totalMesasPadrao?: number;
  onSelecionarMesa: (comanda: Comanda) => void;
  onAbrirMesa: (numeroMesa?: string) => void;
  onFecharConta: (comanda: Comanda) => void;
  onCancelarComanda: (comanda: Comanda) => void;
  onReceberPagamento: (comanda: Comanda) => void;
}

export const MesasCaixaView: React.FC<MesasCaixaViewProps> = ({
  comandas,
  garcons = [],
  totalMesasPadrao = 12,
  onSelecionarMesa,
  onAbrirMesa,
  onFecharConta,
  onCancelarComanda,
  onReceberPagamento,
}) => {
  const [filtro, setFiltro] = useState<FiltroMesaCaixa>('todas');

  const garcomMap = useMemo(() => {
    const map = new Map<number, string>();
    garcons.forEach((g) => map.set(g.id, g.nome));
    return map;
  }, [garcons]);

  const listaMesas = useMemo(() => {
    const mesasSet = new Set<string>();
    for (let i = 1; i <= totalMesasPadrao; i++) {
      mesasSet.add(String(i));
    }
    comandas.forEach((c) => {
      if (c.status === 'aberta' || c.status === 'fechada') {
        mesasSet.add(String(c.mesa));
      }
    });
    return Array.from(mesasSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [totalMesasPadrao, comandas]);

  const comandaPorMesa = useMemo(() => {
    const map = new Map<string, Comanda>();
    comandas.forEach((c) => {
      if (c.status === 'aberta' || c.status === 'fechada') {
        map.set(String(c.mesa), c);
      }
    });
    return map;
  }, [comandas]);

  const contadores = useMemo(() => {
    let livres = 0;
    let abertas = 0;
    let contas = 0;

    listaMesas.forEach((m) => {
      const cmd = comandaPorMesa.get(m);
      if (!cmd) livres++;
      else if (cmd.status === 'fechada') contas++;
      else if (cmd.status === 'aberta') abertas++;
    });

    return { total: listaMesas.length, livres, abertas, contas };
  }, [listaMesas, comandaPorMesa]);

  const mesasExibidas = useMemo(() => {
    return listaMesas.filter((m) => {
      const cmd = comandaPorMesa.get(m);
      if (filtro === 'livres') return !cmd;
      if (filtro === 'abertas') return cmd?.status === 'aberta';
      if (filtro === 'contas') return cmd?.status === 'fechada';
      return true;
    });
  }, [listaMesas, comandaPorMesa, filtro]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg p-6 gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-text tracking-tight">Mesas do Salão</h2>
            <span className="text-xs font-bold text-text-2 bg-surface-2 px-2.5 py-1 rounded-full border border-border">
              {contadores.total} cadastradas
            </span>
          </div>
          <p className="text-xs text-text-2 mt-1">
            {contadores.abertas} abertas · {contadores.contas} aguardando pagamento ·{' '}
            {contadores.livres} livres
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-full border border-border text-xs">
            <button
              onClick={() => setFiltro('todas')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                filtro === 'todas'
                  ? 'bg-surface text-text shadow-soft'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              Todas ({contadores.total})
            </button>
            <button
              onClick={() => setFiltro('livres')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                filtro === 'livres'
                  ? 'bg-success-soft text-success shadow-soft'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              Livres ({contadores.livres})
            </button>
            <button
              onClick={() => setFiltro('abertas')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                filtro === 'abertas'
                  ? 'bg-brand-soft text-brand-text shadow-soft'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              Abertas ({contadores.abertas})
            </button>
            <button
              onClick={() => setFiltro('contas')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all ${
                filtro === 'contas'
                  ? 'bg-danger-soft text-danger shadow-soft'
                  : 'text-text-2 hover:text-text'
              }`}
            >
              Conta pedida ({contadores.contas})
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onAbrirMesa()}
            className="font-bold shrink-0"
          >
            Abrir Mesa
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {mesasExibidas.map((mesaNum) => {
            const comanda = comandaPorMesa.get(mesaNum);
            const isLivre = !comanda;
            const isFechada = comanda?.status === 'fechada';

            const garcomNome = comanda ? garcomMap.get(comanda.garcom_id) || `Garçom #${comanda.garcom_id}` : '';
            const itensCount = (comanda?.itens || []).reduce((acc, it) => acc + it.quantidade, 0);
            const totalValor = comanda ? parseFloat(comanda.total || comanda.subtotal || '0') : 0;

            if (isLivre) {
              return (
                <div
                  key={mesaNum}
                  className="rounded-card border-2 border-dashed border-success/30 bg-surface/80 p-5 flex flex-col justify-between hover:border-success hover:bg-surface transition-all group min-h-[170px]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black text-text">Mesa {mesaNum.padStart(2, '0')}</h3>
                      <p className="text-xs text-text-2 mt-1">Pronta para atendimento</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-success-soft text-success text-[11px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Livre
                    </span>
                  </div>

                  <div className="pt-4 border-t border-dashed border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => onAbrirMesa(mesaNum)}
                      className="w-full text-xs font-bold"
                    >
                      Abrir Mesa
                    </Button>
                  </div>
                </div>
              );
            }

            if (isFechada && comanda) {
              return (
                <div
                  key={mesaNum}
                  className="rounded-card border-2 border-danger bg-danger-soft/20 p-5 flex flex-col justify-between shadow-soft min-h-[170px] relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 bottom-0 w-2 bg-danger" />
                  <div className="pl-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-black text-text">Mesa {mesaNum.padStart(2, '0')}</h3>
                        <p className="text-xs text-danger font-bold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          Conta pedida {comanda.fechada_em ? `há ${formatElapsedTime(comanda.fechada_em)}` : ''}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-danger text-white text-[11px] font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Aguardando Caixa
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-text-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-text-2" />
                        {garcomNome}
                      </span>
                      <span className="font-bold text-text">{itensCount} itens</span>
                    </div>

                    <div className="mt-2 text-right">
                      <span className="text-xs text-text-2">Total a receber: </span>
                      <span className="text-lg font-black text-text">{formatCurrency(totalValor)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-danger/20 flex gap-2 pl-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onReceberPagamento(comanda)}
                      className="w-full text-xs font-black shadow-soft"
                    >
                      Receber {formatCurrency(totalValor)}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={mesaNum}
                className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between shadow-soft hover:shadow-modal transition-all min-h-[170px] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 bottom-0 w-2 bg-brand" />
                <div className="pl-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black text-text">Mesa {mesaNum.padStart(2, '0')}</h3>
                      <p className="text-xs text-text-2 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-text-2" />
                        Aberta há {formatElapsedTime(comanda!.aberta_em)}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-brand-soft text-brand-text text-[11px] font-bold">
                      Em Consumo
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-text-2">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-text-2" />
                      {garcomNome}
                    </span>
                    <span className="font-bold text-text">{itensCount} itens</span>
                  </div>

                  <div className="mt-2 text-right">
                    <span className="text-xs text-text-2">Subtotal: </span>
                    <span className="text-base font-black text-text">{formatCurrency(totalValor)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center gap-2 pl-1">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ShoppingCart className="w-3 h-3" />}
                    onClick={() => onSelecionarMesa(comanda!)}
                    className="flex-1 text-xs font-bold"
                  >
                    Ver / Lançar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Receipt className="w-3 h-3 text-danger" />}
                    onClick={() => onFecharConta(comanda!)}
                    disabled={itensCount === 0}
                    className="text-xs font-bold text-danger hover:bg-danger-soft"
                    title={
                      itensCount === 0
                        ? 'Lance itens antes de fechar a conta'
                        : 'Fechar conta e liberar para pagamento'
                    }
                  >
                    Fechar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancelarComanda(comanda!)}
                    className="px-2 text-text-2 hover:text-danger hover:bg-danger-soft"
                    title="Cancelar comanda e liberar a mesa"
                    aria-label={`Cancelar comanda da mesa ${mesaNum}`}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
