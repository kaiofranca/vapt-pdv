import React, { useMemo } from 'react';
import {
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowRight,
  Banknote,
  QrCode,
  CreditCard,
  Printer,
} from 'lucide-react';
import type { Comanda, Usuario } from '../../../types/api';
import { formatCurrency, formatElapsedTime } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface ReceberCaixaViewProps {
  comandas: Comanda[];
  garcons?: Usuario[];
  onReceberPagamento: (comanda: Comanda) => void;
  onVerComprovante: (comanda: Comanda) => void;
}

export const ReceberCaixaView: React.FC<ReceberCaixaViewProps> = ({
  comandas,
  garcons = [],
  onReceberPagamento,
  onVerComprovante,
}) => {
  const garcomMap = useMemo(() => {
    const map = new Map<number, string>();
    garcons.forEach((g) => map.set(g.id, g.nome));
    return map;
  }, [garcons]);

  const contasPedidas = useMemo(() => {
    return comandas.filter((c) => c.status === 'fechada');
  }, [comandas]);

  const contasPagasHoje = useMemo(() => {
    return comandas
      .filter((c) => c.status === 'paga')
      .sort((a, b) => {
        const timeA = a.paga_em ? new Date(a.paga_em).getTime() : 0;
        const timeB = b.paga_em ? new Date(b.paga_em).getTime() : 0;
        return timeB - timeA;
      });
  }, [comandas]);

  const comandaMaisAntiga = useMemo(() => {
    if (contasPedidas.length === 0) return null;
    return [...contasPedidas].sort((a, b) => {
      const timeA = a.fechada_em ? new Date(a.fechada_em).getTime() : 0;
      const timeB = b.fechada_em ? new Date(b.fechada_em).getTime() : 0;
      return timeA - timeB;
    })[0];
  }, [contasPedidas]);

  const renderIconeForma = (forma: string | null) => {
    switch (forma) {
      case 'dinheiro':
        return <Banknote className="w-3.5 h-3.5 text-success" />;
      case 'pix':
        return <QrCode className="w-3.5 h-3.5 text-brand-text" />;
      case 'cartao':
        return <CreditCard className="w-3.5 h-3.5 text-text" />;
      default:
        return <Receipt className="w-3.5 h-3.5 text-text-2" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg p-6 gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-text tracking-tight">Receber & Quitações</h2>
            {contasPedidas.length > 0 ? (
              <span className="text-xs font-bold text-white bg-danger px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-soft">
                <AlertTriangle className="w-3.5 h-3.5" />
                {contasPedidas.length} {contasPedidas.length === 1 ? 'conta pedida' : 'contas pedidas'}
              </span>
            ) : (
              <span className="text-xs font-bold text-success bg-success-soft px-3 py-1 rounded-full border border-success/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sem contas pendentes
              </span>
            )}
          </div>
          <p className="text-xs text-text-2 mt-1">
            Frente de cobrança e histórico das vendas recebidas na sessão atual
          </p>
        </div>
      </div>

      {comandaMaisAntiga && (
        <div className="bg-brand-soft border-2 border-brand/40 rounded-card p-4 flex items-center justify-between shadow-soft shrink-0 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand text-on-brand flex items-center justify-center font-black">
              <Clock className="w-5 h-5 text-on-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-text">
                  Mesa {comandaMaisAntiga.mesa} pediu a conta
                </span>
                <span className="text-xs text-danger font-bold bg-danger-soft px-2 py-0.5 rounded-full border border-danger/30">
                  há {comandaMaisAntiga.fechada_em ? formatElapsedTime(comandaMaisAntiga.fechada_em) : 'pouco'}
                </span>
              </div>
              <p className="text-xs text-text-2 mt-0.5">
                Garçom: {garcomMap.get(comandaMaisAntiga.garcom_id) || `Garçom #${comandaMaisAntiga.garcom_id}`} · Total:{' '}
                <strong className="text-text font-black">
                  {formatCurrency(parseFloat(comandaMaisAntiga.total || comandaMaisAntiga.subtotal || '0'))}
                </strong>
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => onReceberPagamento(comandaMaisAntiga)}
            className="font-black shadow-soft shrink-0"
          >
            Receber Agora
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-8 pr-1">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              Contas Pedidas — Aguardando Pagamento ({contasPedidas.length})
            </h3>
          </div>

          {contasPedidas.length === 0 ? (
            <div className="bg-surface rounded-card border border-border p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <h4 className="text-sm font-bold text-text">Tudo em dia!</h4>
              <p className="text-xs text-text-2 max-w-sm mt-1">
                Nenhuma mesa está com a conta fechada aguardando pagamento no momento. Todas as mesas abertas continuam em consumo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {contasPedidas.map((comanda) => {
                const garcomNome =
                  garcomMap.get(comanda.garcom_id) || `Garçom #${comanda.garcom_id}`;
                const totalValor = parseFloat(comanda.total || comanda.subtotal || '0');
                const subtotalValor = parseFloat(comanda.subtotal || '0');
                const taxaValor = comanda.taxa_servico ? parseFloat(comanda.taxa_servico) : 0;
                const itens = comanda.itens || [];

                return (
                  <div
                    key={comanda.id}
                    className="bg-surface rounded-card border-2 border-danger/60 p-5 shadow-soft flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-danger" />

                    <div className="pl-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-2xl font-black text-text">Mesa {comanda.mesa}</h4>
                            <span className="font-mono text-xs text-text-2">#{comanda.id}</span>
                          </div>
                          {comanda.nome_cliente && (
                            <p className="text-xs font-semibold text-text mt-0.5">
                              Cliente: {comanda.nome_cliente}
                            </p>
                          )}
                          <p className="text-xs text-text-2 flex items-center gap-1 mt-1">
                            <User className="w-3 h-3 text-text-2" />
                            {garcomNome}
                          </p>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-danger-soft text-danger text-[11px] font-black flex items-center gap-1 border border-danger/20">
                          <Clock className="w-3 h-3" />
                          {comanda.fechada_em ? formatElapsedTime(comanda.fechada_em) : 'esperando'}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-2 mb-1.5">
                          Itens Consumidos ({itens.length})
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-text">
                          {itens.map((it) => (
                            <div key={it.id} className="flex justify-between items-center">
                              <span className="truncate pr-2">
                                <strong className="font-bold">{it.quantidade}x</strong> {it.nome_copiado}
                              </span>
                              <span className="font-mono text-text-2 shrink-0">
                                {formatCurrency(parseFloat(it.preco_copiado) * it.quantidade)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-dashed border-border space-y-1 text-xs">
                        <div className="flex justify-between text-text-2">
                          <span>Subtotal</span>
                          <span className="font-mono">{formatCurrency(subtotalValor)}</span>
                        </div>
                        {taxaValor > 0 && (
                          <div className="flex justify-between text-text-2">
                            <span>Taxa de serviço (10%)</span>
                            <span className="font-mono text-brand-text font-bold">
                              {formatCurrency(taxaValor)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-black text-text pt-1">
                          <span>Total a Cobrar</span>
                          <span className="text-xl text-text font-black">
                            {formatCurrency(totalValor)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border pl-2">
                      <Button
                        variant="primary"
                        size="md"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                        onClick={() => onReceberPagamento(comanda)}
                        className="w-full text-sm font-black shadow-soft"
                      >
                        Receber {formatCurrency(totalValor)}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              Recebidos Hoje ({contasPagasHoje.length} vendas quitadas)
            </h3>
          </div>

          {contasPagasHoje.length === 0 ? (
            <div className="bg-surface rounded-card border border-border p-6 text-center text-xs text-text-2">
              Nenhuma venda quitada ainda nesta sessão.
            </div>
          ) : (
            <div className="bg-surface rounded-card border border-border divide-y divide-border overflow-hidden shadow-soft">
              {contasPagasHoje.map((comanda) => {
                const totalValor = parseFloat(comanda.total || comanda.subtotal || '0');
                const horaPagamento = comanda.paga_em
                  ? new Date(comanda.paga_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '—';

                return (
                  <div
                    key={comanda.id}
                    className="p-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-success-soft text-success flex items-center justify-center font-bold">
                        {renderIconeForma(comanda.forma_pagamento)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text">
                            Mesa {comanda.mesa} · Comanda #{comanda.id}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-soft text-success border border-success/20">
                            Quitada
                          </span>
                        </div>
                        <p className="text-xs text-text-2 mt-0.5 flex items-center gap-2">
                          <span>Pago às {horaPagamento}</span>
                          <span>•</span>
                          <span className="capitalize">
                            {comanda.forma_pagamento || 'Dinheiro'}
                          </span>
                          {comanda.nome_cliente && (
                            <>
                              <span>•</span>
                              <span>Cliente: {comanda.nome_cliente}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-base font-black text-text">
                        {formatCurrency(totalValor)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Printer className="w-3.5 h-3.5" />}
                        onClick={() => onVerComprovante(comanda)}
                        className="text-xs font-bold"
                      >
                        Reimprimir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
