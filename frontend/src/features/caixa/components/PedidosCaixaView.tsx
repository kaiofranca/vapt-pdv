import React, { useState, useMemo } from 'react';
import {
  Search,
  Receipt,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react';
import type { Comanda, Usuario, StatusComanda } from '../../../types/api';
import { formatCurrency } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export type FiltroStatusPedido = 'todos' | 'aberta' | 'fechada' | 'paga' | 'cancelada';

export interface PedidosCaixaViewProps {
  comandas: Comanda[];
  garcons?: Usuario[];
  onSelecionarComanda: (comanda: Comanda) => void;
  onReceberPagamento: (comanda: Comanda) => void;
  onVerComprovante?: (comanda: Comanda) => void;
}

export const PedidosCaixaView: React.FC<PedidosCaixaViewProps> = ({
  comandas,
  garcons = [],
  onSelecionarComanda,
  onReceberPagamento,
  onVerComprovante,
}) => {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusPedido>('todos');
  const [busca, setBusca] = useState<string>('');

  const garcomMap = useMemo(() => {
    const map = new Map<number, string>();
    garcons.forEach((g) => map.set(g.id, g.nome));
    return map;
  }, [garcons]);

  const contadores = useMemo(() => {
    let abertas = 0;
    let fechadas = 0;
    let pagas = 0;
    let canceladas = 0;

    comandas.forEach((c) => {
      if (c.status === 'aberta') abertas++;
      else if (c.status === 'fechada') fechadas++;
      else if (c.status === 'paga') pagas++;
      else if (c.status === 'cancelada') canceladas++;
    });

    return { total: comandas.length, abertas, fechadas, pagas, canceladas };
  }, [comandas]);

  const comandasFiltradas = useMemo(() => {
    return comandas.filter((c) => {
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;

      const termo = busca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        String(c.id).includes(termo) ||
        String(c.mesa).toLowerCase().includes(termo) ||
        (c.nome_cliente && c.nome_cliente.toLowerCase().includes(termo));

      return matchStatus && matchBusca;
    });
  }, [comandas, filtroStatus, busca]);

  const renderStatusBadge = (status: StatusComanda) => {
    switch (status) {
      case 'aberta':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand-text border border-brand/20">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Em Consumo
          </span>
        );
      case 'fechada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-danger-soft text-danger border border-danger/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Conta Pedida
          </span>
        );
      case 'paga':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-success-soft text-success border border-success/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pago
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-surface-2 text-text-2 border border-border">
            <XCircle className="w-3.5 h-3.5" />
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const renderFormaPagamento = (forma: string | null) => {
    if (!forma) return <span className="text-text-2/60">—</span>;
    switch (forma) {
      case 'dinheiro':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-text font-medium">
            <Banknote className="w-3.5 h-3.5 text-success" /> Dinheiro
          </span>
        );
      case 'pix':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-text font-medium">
            <QrCode className="w-3.5 h-3.5 text-brand-text" /> Pix
          </span>
        );
      case 'cartao':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-text font-medium">
            <CreditCard className="w-3.5 h-3.5 text-text" /> Cartão
          </span>
        );
      default:
        return <span className="text-xs text-text capitalize">{forma}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg p-6 gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-text tracking-tight">Pedidos & Comandas</h2>
          <p className="text-xs text-text-2 mt-1">
            {contadores.total} comandas registradas no banco · {contadores.pagas} quitadas hoje
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar comanda, mesa ou cliente..."
              className="w-full pl-9 pr-3 py-1.5 rounded-input bg-surface border border-border text-xs text-text placeholder:text-text-2 focus:outline-none focus:border-text shadow-soft"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => setFiltroStatus('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroStatus === 'todos'
              ? 'bg-text text-bg shadow-soft'
              : 'bg-surface text-text-2 hover:text-text border border-border'
          }`}
        >
          Todos ({contadores.total})
        </button>
        <button
          onClick={() => setFiltroStatus('aberta')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroStatus === 'aberta'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface text-text-2 hover:text-text border border-border'
          }`}
        >
          Em consumo ({contadores.abertas})
        </button>
        <button
          onClick={() => setFiltroStatus('fechada')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroStatus === 'fechada'
              ? 'bg-danger text-white dark:text-bg shadow-soft'
              : 'bg-surface text-text-2 hover:text-text border border-border'
          }`}
        >
          Conta pedida ({contadores.fechadas})
        </button>
        <button
          onClick={() => setFiltroStatus('paga')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroStatus === 'paga'
              ? 'bg-success text-white dark:text-bg shadow-soft'
              : 'bg-surface text-text-2 hover:text-text border border-border'
          }`}
        >
          Pagos ({contadores.pagas})
        </button>
        <button
          onClick={() => setFiltroStatus('cancelada')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroStatus === 'cancelada'
              ? 'bg-text-2 text-bg shadow-soft'
              : 'bg-surface text-text-2 hover:text-text border border-border'
          }`}
        >
          Cancelados ({contadores.canceladas})
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-card border border-border bg-surface shadow-soft flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-surface-2 border-b border-border text-text-2 font-bold uppercase tracking-wider z-10">
              <tr>
                <th className="py-3 px-4">Comanda</th>
                <th className="py-3 px-4">Mesa</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Garçom</th>
                <th className="py-3 px-4">Abertura</th>
                <th className="py-3 px-4">Itens</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comandasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-text-2">
                    Nenhuma comanda encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                comandasFiltradas.map((comanda) => {
                  const garcomNome =
                    garcomMap.get(comanda.garcom_id) || `Garçom #${comanda.garcom_id}`;
                  const totalValor = parseFloat(
                    comanda.total || comanda.subtotal || '0'
                  );
                  const horaAbertura = new Date(comanda.aberta_em).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={comanda.id}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer"
                      onClick={() => {
                        if (comanda.status === 'aberta') onSelecionarComanda(comanda);
                        else if (comanda.status === 'fechada') onReceberPagamento(comanda);
                        else if (comanda.status === 'paga' && onVerComprovante) onVerComprovante(comanda);
                      }}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-text">
                        #{String(comanda.id).padStart(4, '0')}
                      </td>
                      <td className="py-3 px-4 font-bold text-text">
                        Mesa {comanda.mesa}
                      </td>
                      <td className="py-3 px-4 text-text-2">
                        {comanda.nome_cliente || <span className="text-text-2/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-text-2 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-text-2/60" />
                        {garcomNome}
                      </td>
                      <td className="py-3 px-4 text-text-2">
                        {horaAbertura}
                      </td>
                      <td className="py-3 px-4 text-text font-medium">
                        {comanda.itens?.length || 0}
                      </td>
                      <td className="py-3 px-4 font-bold text-text">
                        {formatCurrency(totalValor)}
                      </td>
                      <td className="py-3 px-4">
                        {renderFormaPagamento(comanda.forma_pagamento)}
                      </td>
                      <td className="py-3 px-4">
                        {renderStatusBadge(comanda.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {comanda.status === 'aberta' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelecionarComanda(comanda);
                            }}
                            className="text-[11px] font-bold"
                          >
                            Abrir no Caixa
                          </Button>
                        )}
                        {comanda.status === 'fechada' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReceberPagamento(comanda);
                            }}
                            className="text-[11px] font-black"
                          >
                            Receber
                          </Button>
                        )}
                        {comanda.status === 'paga' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Receipt className="w-3 h-3 text-text-2" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerComprovante?.(comanda);
                            }}
                            className="text-[11px] font-bold text-text-2"
                          >
                            Recibo
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
