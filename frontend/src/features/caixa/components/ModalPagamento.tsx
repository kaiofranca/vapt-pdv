import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Copy,
  Check,
  Clock,
  Trash2,
  AlertTriangle,
  Users,
} from 'lucide-react';
import type { Comanda } from '../../../types/api';
import { formatCurrency } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { ComprovanteVenda, type ParcelaPagamento } from './ComprovanteVenda';
import { ModoDinheiroTeclado } from './ModoDinheiroTeclado';
import { ModalSplitPayment } from './ModalSplitPayment';
import {
  caixaSatApi,
  CaixaSatError,
  type ReciboCompletoResposta,
} from '../api/caixaSatApi';

export interface ModalPagamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onNovaVenda?: () => void;
  comanda: Comanda | null;
  onPagamentoConcluido: (comandaPaga: Comanda) => void;
  nomeOperador?: string;
  documentoClienteInicial?: string;
  onToast: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

export const ModalPagamento: React.FC<ModalPagamentoProps> = ({
  isOpen,
  onClose,
  onNovaVenda,
  comanda,
  onPagamentoConcluido,
  nomeOperador = 'Caixa 01',
  documentoClienteInicial = '',
  onToast,
}) => {
  const [etapa, setEtapa] = useState<'pagamento' | 'comprovante'>('pagamento');
  const [comandaPaga, setComandaPaga] = useState<Comanda | null>(null);

  // Forma selecionada na aba central
  const [formaAtiva, setFormaAtiva] = useState<'dinheiro' | 'pix' | 'cartao'>('dinheiro');
  const [subtipoCartao, setSubtipoCartao] = useState<'credito' | 'debito'>('debito');

  // Parcelas já registradas nesta quitação
  const [parcelas, setParcelas] = useState<ParcelaPagamento[]>([]);

  // Valor a cobrar na parcela atual (em formato string digitável)
  const [valorParcelaInput, setValorParcelaInput] = useState<string>('');
  // Valor recebido em dinheiro pelo operador (para troco)
  const [valorRecebidoInput, setValorRecebidoInput] = useState<string>('');

  // Opções fiscais
  const [documentoCliente, setDocumentoCliente] = useState<string>(documentoClienteInicial);
  const [imprimirViaCliente, setImprimirViaCliente] = useState<boolean>(true);

  // Confirmação de segurança: tentar sair com dinheiro na gaveta
  const [showConfirmacaoGaveta, setShowConfirmacaoGaveta] = useState<boolean>(false);

  // Split payment (dividir por pessoas ou itens - C11)
  const [isSplitOpen, setIsSplitOpen] = useState<boolean>(false);

  // Feedback de cópia do código Pix
  const [pixCopiado, setPixCopiado] = useState<boolean>(false);

  // Cronômetro Pix regressivo (5 minutos = 300 segundos)
  const [tempoPixRestante, setTempoPixRestante] = useState<number>(300);

  // Estados de integração com satélite caixa-service (:3002)
  const [trocoOficialSat, setTrocoOficialSat] = useState<string | null>(null);
  const [reciboOficial, setReciboOficial] = useState<ReciboCompletoResposta | null>(null);
  const [paperText, setPaperText] = useState<string | null>(null);
  const [isProcessandoSat, setIsProcessandoSat] = useState<boolean>(false);
  const [erroSat, setErroSat] = useState<string | null>(null);

  // Código Pix Copia-e-Cola simulado
  const codigoPixSimulado = useMemo(() => {
    const id = comanda ? comanda.id : '00';
    return `00020126580014br.gov.bcb.pix0136vapt-pdv-caixa-${id}@uern.br5204000053039865802BR5913VaptPDV6008MOSSORO62070503***6304ABCD`;
  }, [comanda]);

  // Total da comanda em centavos inteiros (eliminando resíduos IEEE 754)
  const totalCentavos = useMemo(() => {
    if (!comanda) return 0;
    const valor = parseFloat(comanda.total || comanda.subtotal || '0');
    return Math.round(valor * 100);
  }, [comanda]);

  // Total já pago acumulado em centavos
  const jaPagoCentavos = useMemo(() => {
    return parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
  }, [parcelas]);

  // Falta pagar em centavos
  const faltaPagarCentavos = Math.max(0, totalCentavos - jaPagoCentavos);

  // Troco calculado em centavos com validação estrita Number.isFinite
  const valorRecebidoNum = parseFloat(valorRecebidoInput.replace(',', '.'));
  const valorParcelaNum = parseFloat(valorParcelaInput.replace(',', '.'));
  const valorRecebidoCentavos = Number.isFinite(valorRecebidoNum) ? Math.round(valorRecebidoNum * 100) : 0;
  const valorParcelaCentavos = Number.isFinite(valorParcelaNum) ? Math.round(valorParcelaNum * 100) : 0;

  // Inicializa valores ao abrir modal
  useEffect(() => {
    if (isOpen && comanda) {
      setEtapa('pagamento');
      setParcelas([]);
      setComandaPaga(null);
      setShowConfirmacaoGaveta(false);
      setPixCopiado(false);
      setTempoPixRestante(300);
      setDocumentoCliente(documentoClienteInicial);
      setTrocoOficialSat(null);
      setReciboOficial(null);
      setPaperText(null);
      setErroSat(null);
      setIsProcessandoSat(false);

      const totalFormatado = (totalCentavos / 100).toFixed(2);
      setValorParcelaInput(totalFormatado);
      setValorRecebidoInput(totalFormatado);
    }
  }, [isOpen, comanda, totalCentavos, documentoClienteInicial]);

  // Atualiza o valor da parcela padrão quando o saldo restante mudar
  useEffect(() => {
    if (etapa === 'pagamento') {
      const saldoFormatado = (faltaPagarCentavos / 100).toFixed(2);
      setValorParcelaInput(saldoFormatado);
      setValorRecebidoInput(saldoFormatado);
    }
  }, [faltaPagarCentavos, etapa]);

  // Efeito do cronômetro regressivo Pix
  useEffect(() => {
    if (!isOpen || etapa !== 'pagamento' || formaAtiva !== 'pix') return;

    const timer = setInterval(() => {
      setTempoPixRestante((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, etapa, formaAtiva]);

  // Formatação do cronômetro mm:ss
  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  // Copiar código Pix
  const handleCopiarPix = () => {
    navigator.clipboard.writeText(codigoPixSimulado);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  // Adicionar / Quitar parcela via satélite caixa-service :3002 (EARS-CXSAT-05, EARS-CXSAT-08, EARS-CXSAT-09, EARS-CXSAT-10)
  const handleLancarParcela = async (forma: 'dinheiro' | 'pix' | 'cartao') => {
    if (!comanda) return;

    if (!Number.isFinite(valorParcelaCentavos) || valorParcelaCentavos <= 0) {
      onToast('erro', 'Informe um valor válido maior que zero.');
      return;
    }

    if (valorParcelaCentavos > faltaPagarCentavos) {
      onToast('erro', 'O valor da parcela não pode exceder o saldo pendente.');
      return;
    }

    if (
      forma === 'dinheiro' &&
      (!Number.isFinite(valorRecebidoCentavos) || valorRecebidoCentavos < valorParcelaCentavos)
    ) {
      setErroSat('Valor insuficiente para troco.');
      onToast('erro', 'O valor recebido em dinheiro não pode ser menor que a parcela.');
      return;
    }

    setIsProcessandoSat(true);
    setErroSat(null);

    const valorAplicadoStr = (valorParcelaCentavos / 100).toFixed(2);
    const valorRecebidoStr =
      forma === 'dinheiro'
        ? (valorRecebidoCentavos / 100).toFixed(2)
        : valorAplicadoStr;

    try {
      const res = await caixaSatApi.pagarComanda(comanda.id, {
        forma_pagamento: forma,
        valor_aplicado: valorAplicadoStr,
        valor_recebido: valorRecebidoStr,
        numero_cota: parcelas.length + 1,
        operador_nome: nomeOperador,
      });

      const trocoSatStr = res.parcela_registrada?.troco || res.troco_total || '0.00';
      const trocoSatCentavos = Math.round(parseFloat(trocoSatStr) * 100);

      const novaParcela: ParcelaPagamento = {
        id: String(res.parcela_registrada?.id || Date.now()),
        forma,
        subtipo: forma === 'cartao' ? subtipoCartao : undefined,
        valorCentavos: valorParcelaCentavos,
        valorRecebidoCentavos: forma === 'dinheiro' ? valorRecebidoCentavos : undefined,
        trocoCentavos: forma === 'dinheiro' ? trocoSatCentavos : undefined,
      };

      setParcelas((prev) => [...prev, novaParcela]);
      setTrocoOficialSat(trocoSatStr);

      onToast(
        'sucesso',
        `Parcela de ${formatCurrency(valorParcelaCentavos / 100)} quitada (:3002). Troco: R$ ${trocoSatStr}`
      );

      const novoJaPago = jaPagoCentavos + valorParcelaCentavos;
      const estaQuitada =
        res.status === 'paga' ||
        parseFloat(res.saldo_restante || '0') <= 0 ||
        novoJaPago >= totalCentavos;

      if (estaQuitada) {
        try {
          const recibo = await caixaSatApi.obterRecibo(comanda.id);
          setReciboOficial(recibo);
          setPaperText(recibo.paper_text);
        } catch {
          // Fallback para recibo formatado local
        }

        const cPaga: Comanda = {
          ...comanda,
          status: 'paga',
          forma_pagamento: forma,
          paga_em: new Date().toISOString(),
        };

        setComandaPaga(cPaga);
        setEtapa('comprovante');
        onPagamentoConcluido(cPaga);
        onToast('sucesso', `Venda concluída com sucesso! Mesa ${comanda.mesa} liberada.`);
      }
    } catch (err: any) {
      const msg =
        err instanceof CaixaSatError
          ? err.message
          : err?.message || 'Erro na comunicação com caixa-service (:3002).';
      setErroSat(msg);
      onToast('erro', msg);
      // EARS-CXSAT-10: NÃO reseta os inputs do usuário para permitir nova tentativa
    } finally {
      setIsProcessandoSat(false);
    }
  };

  // Remover parcela (estorno)
  const handleRemoverParcela = (id: string) => {
    setParcelas((prev) => prev.filter((p) => p.id !== id));
    onToast('sucesso', 'Parcela estornada do pagamento.');
  };

  // Aplica uma cota calculada pelo ModalSplitPayment (C11)
  const handleAplicarCotaSplit = (valorCentavos: number, descricao: string) => {
    const valorReais = (valorCentavos / 100).toFixed(2);
    setValorParcelaInput(valorReais);
    setValorRecebidoInput(valorReais);
    onToast('sucesso', `${descricao}: valor R$ ${formatCurrency(valorCentavos / 100)} selecionado.`);
  };

  // Fechamento seguro do modal
  const handleTentarFechar = () => {
    const temDinheiroLancado = parcelas.some((p) => p.forma === 'dinheiro');
    if (etapa === 'pagamento' && temDinheiroLancado) {
      setShowConfirmacaoGaveta(true);
      return;
    }
    onClose();
  };

  // Listener da tecla Escape chamando handleTentarFechar com proteção de gaveta
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showConfirmacaoGaveta) {
          setShowConfirmacaoGaveta(false);
        } else {
          handleTentarFechar();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, showConfirmacaoGaveta, parcelas, etapa]);

  // Concluir Venda (Liquidação final com obtenção do recibo térmico .paper de 48 colunas)
  const handleConcluirVenda = async () => {
    if (!comanda) return;

    if (faltaPagarCentavos > 0) {
      // Se não há parcelas lançadas ainda, lança a forma ativa diretamente
      if (parcelas.length === 0) {
        await handleLancarParcela(formaAtiva);
        return;
      }
      onToast('erro', `Falta quitar ${formatCurrency(faltaPagarCentavos / 100)} antes de concluir.`);
      return;
    }

    setIsProcessandoSat(true);
    setErroSat(null);

    try {
      // Busca recibo canônico térmico gerado por :3002
      let recibo = reciboOficial;
      if (!recibo) {
        try {
          recibo = await caixaSatApi.obterRecibo(comanda.id);
          setReciboOficial(recibo);
          setPaperText(recibo.paper_text);
        } catch {
          // Fallback gracioso silencioso
        }
      }

      const cPaga: Comanda = {
        ...comanda,
        status: 'paga',
        forma_pagamento: formaAtiva,
        paga_em: new Date().toISOString(),
      };

      setComandaPaga(cPaga);
      setEtapa('comprovante');
      onPagamentoConcluido(cPaga);
      onToast('sucesso', `Venda concluída com sucesso! Mesa ${comanda.mesa} liberada.`);
    } catch (err: any) {
      const msg =
        err instanceof CaixaSatError
          ? err.message
          : err?.message || 'Erro ao concluir venda no satélite.';
      setErroSat(msg);
      onToast('erro', msg);
    } finally {
      setIsProcessandoSat(false);
    }
  };

  if (!isOpen || !comanda) return null;

  // Porcentagem de quitação para a ProgressBar
  const percentualQuitado =
    totalCentavos > 0 ? Math.min(100, Math.round((jaPagoCentavos / totalCentavos) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-pagamento"
    >
      {/* Backdrop com blur suave */}
      <div
        className="fixed inset-0 bg-[#2B2019]/60 backdrop-blur-sm transition-opacity"
        onClick={handleTentarFechar}
        aria-hidden="true"
      />

      {/* Conteúdo do Modal Desktop */}
      <div className="relative w-full max-w-6xl rounded-card-lg bg-surface border border-border shadow-modal p-6 text-left transition-all z-10 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-input bg-brand text-on-brand flex items-center justify-center shadow-soft">
              <CreditCard className="w-5 h-5 text-on-brand" />
            </div>
            <div>
              <h1 id="titulo-modal-pagamento" className="text-xl font-black text-text leading-tight">
                {etapa === 'comprovante' ? 'Comprovante da Venda (.paper)' : 'Fechamento e Pagamento (:3002)'}
              </h1>
              <p className="text-xs text-text-2">
                Mesa {comanda.mesa} · Comanda #{comanda.id} · Operador: {nomeOperador}
              </p>
            </div>
          </div>

          <button
            onClick={handleTentarFechar}
            className="p-2 rounded-btn text-text-2 hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar janela"
          >
            <X className="w-5 h-5 text-text" />
          </button>
        </div>

        {/* Alerta de erro retornado pelo caixa-service com preservação de dados (EARS-CXSAT-10, AC-CXSAT-04) */}
        {erroSat && etapa === 'pagamento' && (
          <div
            role="alert"
            className="p-3 my-2 rounded-input bg-danger-soft border border-danger/30 text-danger text-xs flex items-center gap-2 animate-fadeIn font-semibold"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{erroSat}</span>
          </div>
        )}

        {/* Corpo do Modal: Se etapa === 'comprovante', renderiza o recibo */}
        {etapa === 'comprovante' && comandaPaga ? (
          <div className="flex-1 min-h-0 overflow-y-auto py-2">
            <ComprovanteVenda
              comanda={comandaPaga}
              parcelas={parcelas}
              nomeOperador={nomeOperador}
              documentoCliente={documentoCliente}
              paperText={paperText || undefined}
              reciboOficial={reciboOficial}
              onNovaVenda={() => {
                if (onNovaVenda) {
                  onNovaVenda();
                } else {
                  onClose();
                }
              }}
            />
          </div>
        ) : (
          /* Layout em 3 Colunas: Resumo, Formas de Pagamento e Quitação/Fiscal */
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 overflow-y-auto pr-1">
            {/* ================= COLUNA 1: RESUMO DA VENDA & SPLITS (4 Colunas) ================= */}
            <div className="lg:col-span-4 flex flex-col gap-4 border-r border-border/80 pr-0 lg:pr-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-text-2 tracking-wider">
                  Resumo da Venda
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-text-2">Total a Pagar</span>
                  <span className="text-2xl font-black text-text tabular-nums">
                    {formatCurrency(totalCentavos / 100)}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso da Quitação */}
              <div className="space-y-1.5 p-3 rounded-card bg-surface-2/60 border border-border">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-text-2">Progresso do Pagamento</span>
                  <span className="text-text font-bold tabular-nums">{percentualQuitado}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-border overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-300"
                    style={{ width: `${percentualQuitado}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-text-2">
                    Pago: <strong className="text-text">{formatCurrency(jaPagoCentavos / 100)}</strong>
                  </span>
                  <span className="text-text-2">
                    Falta:{' '}
                    <strong className="text-danger font-bold">
                      {formatCurrency(faltaPagarCentavos / 100)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Troco Oficial Calculado pelo Satélite :3002 */}
              {trocoOficialSat && parseFloat(trocoOficialSat) > 0 && (
                <div
                  className="p-3 rounded-card bg-success-soft border border-success/30 flex items-center justify-between animate-fadeIn"
                  data-testid="troco-oficial-sat"
                >
                  <span className="text-xs font-bold text-success uppercase">
                    Troco Oficial Satélite (:3002)
                  </span>
                  <span className="text-lg font-black text-success tabular-nums">
                    {formatCurrency(parseFloat(trocoOficialSat))}
                  </span>
                </div>
              )}

              {/* Botão C11: Dividir a Conta */}
              <Button
                variant="outline"
                fullWidth
                leftIcon={<Users className="w-4 h-4 text-brand-text" />}
                onClick={() => setIsSplitOpen(true)}
                className="font-bold text-xs min-h-[44px]"
              >
                Dividir Conta (Split Payment)
              </Button>

              {/* Lista de Parcelas Já Lançadas */}
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                <div className="flex justify-between items-center text-xs font-bold text-text-2 uppercase tracking-wider">
                  <span>Parcelas Lançadas ({parcelas.length})</span>
                  {parcelas.length > 0 && <span>Soma: {formatCurrency(jaPagoCentavos / 100)}</span>}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[220px]">
                  {parcelas.length === 0 ? (
                    <div className="p-4 rounded-card border border-dashed border-border text-center text-xs text-text-2">
                      Nenhuma parcela lançada. Selecione a forma ao lado para quitar integral ou parcialmente.
                    </div>
                  ) : (
                    parcelas.map((parc, index) => (
                      <div
                        key={parc.id}
                        className="p-3 rounded-input bg-surface-2/60 border border-border flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-text-2">#{index + 1}</span>
                          <div>
                            <span className="text-xs font-bold text-text block uppercase">
                              {parc.forma} {parc.subtipo ? `(${parc.subtipo})` : ''}
                            </span>
                            {parc.trocoCentavos !== undefined && parc.trocoCentavos > 0 && (
                              <span className="text-[11px] text-success font-medium">
                                Troco: {formatCurrency(parc.trocoCentavos / 100)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-text tabular-nums">
                            {formatCurrency(parc.valorCentavos / 100)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoverParcela(parc.id)}
                            className="p-1 rounded text-text-2 hover:text-danger hover:bg-danger-soft transition-colors"
                            aria-label={`Remover parcela ${index + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ================= COLUNA 2: FORMAS DE PAGAMENTO & ENTRADA (5 Colunas) ================= */}
            <div className="lg:col-span-5 flex flex-col gap-4 border-r border-border/80 pr-0 lg:pr-5">
              {/* Abas das Formas de Pagamento */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFormaAtiva('dinheiro')}
                  className={`py-2.5 px-3 rounded-input text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all min-h-[48px] ${
                    formaAtiva === 'dinheiro'
                      ? 'bg-brand text-on-brand shadow-soft'
                      : 'bg-surface-2 text-text-2 hover:bg-border/40'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Dinheiro</span>
                </button>

                <button
                  onClick={() => setFormaAtiva('pix')}
                  className={`py-2.5 px-3 rounded-input text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all min-h-[48px] ${
                    formaAtiva === 'pix'
                      ? 'bg-brand text-on-brand shadow-soft'
                      : 'bg-surface-2 text-text-2 hover:bg-border/40'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Pix Dinâmico</span>
                </button>

                <button
                  onClick={() => setFormaAtiva('cartao')}
                  className={`py-2.5 px-3 rounded-input text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all min-h-[48px] ${
                    formaAtiva === 'cartao'
                      ? 'bg-brand text-on-brand shadow-soft'
                      : 'bg-surface-2 text-text-2 hover:bg-border/40'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cartão</span>
                </button>
              </div>

              {/* Campo do Valor da Parcela Atual */}
              <div>
                <label className="text-xs font-bold uppercase text-text-2 tracking-wider block mb-1">
                  Valor a Quitar nesta Parcela (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-2 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorParcelaInput}
                    onChange={(e) => setValorParcelaInput(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-input bg-surface border border-border text-text font-black text-lg tabular-nums focus:outline-none focus:border-text focus:ring-1 focus:ring-text shadow-soft"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Painel Específico da Forma Selecionada */}
              {formaAtiva === 'dinheiro' && (
                <ModoDinheiroTeclado
                  totalCentavos={totalCentavos}
                  jaPagoCentavos={jaPagoCentavos}
                  valorParcelaCentavos={valorParcelaCentavos}
                  valorRecebidoInput={valorRecebidoInput}
                  onValorRecebidoChange={setValorRecebidoInput}
                  onConfirmar={() => handleLancarParcela('dinheiro')}
                  disabled={valorParcelaCentavos <= 0 || faltaPagarCentavos <= 0 || isProcessandoSat}
                />
              )}

              {formaAtiva === 'pix' && (
                <div className="p-4 rounded-card bg-surface-2/60 border border-border flex flex-col items-center text-center space-y-3">
                  <div className="p-3 rounded-card bg-white border border-border shadow-sm flex flex-col items-center">
                    <div className="w-36 h-36 bg-white flex items-center justify-center relative">
                      <QrCode className="w-32 h-32 text-[#2B2019]" />
                    </div>
                    <span className="text-[10px] text-gray-500 font-semibold mt-1">
                      QR Code Pix Satélite :3002
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-text-2">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>Expira em:</span>
                    <strong className="text-text font-mono font-bold">
                      {formatarTempo(tempoPixRestante)}
                    </strong>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    leftIcon={pixCopiado ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopiarPix}
                    className="min-h-[40px] text-xs font-bold"
                  >
                    {pixCopiado ? 'Código Pix Copiado!' : 'Copiar Código Pix'}
                  </Button>

                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => handleLancarParcela('pix')}
                    disabled={valorParcelaCentavos <= 0 || faltaPagarCentavos <= 0 || isProcessandoSat}
                    isLoading={isProcessandoSat}
                    className="min-h-[44px] font-bold"
                  >
                    Confirmar Recebimento Pix ({formatCurrency(valorParcelaCentavos / 100)})
                  </Button>
                </div>
              )}

              {formaAtiva === 'cartao' && (
                <div className="p-4 rounded-card bg-surface-2/60 border border-border space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-text-2 tracking-wider block mb-2">
                      Modalidade do Cartão
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubtipoCartao('debito')}
                        className={`py-2 px-3 rounded-btn text-xs font-bold border transition-colors ${
                          subtipoCartao === 'debito'
                            ? 'bg-brand text-on-brand border-brand shadow-sm'
                            : 'bg-surface text-text border-border hover:bg-surface-2'
                        }`}
                      >
                        Débito
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubtipoCartao('credito')}
                        className={`py-2 px-3 rounded-btn text-xs font-bold border transition-colors ${
                          subtipoCartao === 'credito'
                            ? 'bg-brand text-on-brand border-brand shadow-sm'
                            : 'bg-surface text-text border-border hover:bg-surface-2'
                        }`}
                      >
                        Crédito
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-card bg-surface border border-border text-xs text-text-2 text-center space-y-1">
                    <CreditCard className="w-6 h-6 text-brand mx-auto mb-1" />
                    <p className="font-bold text-text">Insira ou aproxime o cartão na maquininha</p>
                    <p className="text-[11px]">
                      Aguarde o comprovante de autorização impresso pelo POS antes de confirmar.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    leftIcon={<CreditCard className="w-4 h-4" />}
                    onClick={() => handleLancarParcela('cartao')}
                    disabled={valorParcelaCentavos <= 0 || faltaPagarCentavos <= 0 || isProcessandoSat}
                    isLoading={isProcessandoSat}
                  >
                    Confirmar Operação com Cartão ({formatCurrency(valorParcelaCentavos / 100)})
                  </Button>
                </div>
              )}
            </div>

            {/* ================= COLUNA 3: FISCAL, CONFERÊNCIA & CONCLUSÃO (3 Colunas) ================= */}
            <div className="lg:col-span-3 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase text-text-2 tracking-wider block">
                  Identificação & Fiscal
                </span>

                {/* CPF/CNPJ do Cliente (Opcional) */}
                <div>
                  <label htmlFor="input-cpf" className="text-xs font-semibold text-text-2 block mb-1">
                    CPF / CNPJ na Nota (Opcional)
                  </label>
                  <input
                    id="input-cpf"
                    type="text"
                    value={documentoCliente}
                    onChange={(e) => setDocumentoCliente(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-input bg-surface border border-border text-text text-sm font-medium focus:outline-none focus:border-text focus:ring-1 focus:ring-text shadow-soft"
                  />
                </div>

                {/* Switches Fiscais */}
                <div className="space-y-3 pt-2 border-t border-border/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-text block">Imprimir Cupom</span>
                      <span className="text-[11px] text-text-2">Via térmica oficial .paper</span>
                    </div>
                    <ToggleSwitch
                      checked={imprimirViaCliente}
                      onChange={setImprimirViaCliente}
                    />
                  </div>

                  <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                    <div>
                      <span className="text-xs font-bold text-text block">Emitir NFC-e</span>
                      <span className="text-[10px] text-text-2">Indisponível na versão 1</span>
                    </div>
                    <ToggleSwitch checked={false} onChange={() => {}} disabled />
                  </div>
                </div>
              </div>

              {/* Botão Primário: Concluir Venda */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="primary"
                  size="action"
                  fullWidth
                  disabled={faltaPagarCentavos > 0 || isProcessandoSat}
                  isLoading={isProcessandoSat}
                  leftIcon={<Check className="w-6 h-6" />}
                  onClick={handleConcluirVenda}
                  className="font-black text-lg h-[64px]"
                >
                  {faltaPagarCentavos > 0
                    ? `Faltam ${formatCurrency(faltaPagarCentavos / 100)}`
                    : 'Concluir Venda'}
                </Button>

                {faltaPagarCentavos === 0 && (
                  <p className="text-[11px] text-center text-success font-semibold mt-2">
                    Quitação integral conferida! Clique para emitir recibo e liberar a mesa.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diálogo de Segurança: Confirmação de Gaveta (Dinheiro Já Lançado) */}
      {showConfirmacaoGaveta && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#2B2019]/70 backdrop-blur-xs"
            onClick={() => setShowConfirmacaoGaveta(false)}
          />
          <div className="relative w-full max-w-md rounded-card-lg bg-surface border border-danger/40 shadow-modal p-6 text-left z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-black text-text">Descartar recebimento em dinheiro?</h3>
                <p className="text-xs text-text-2 mt-0.5">
                  Já existem parcelas em dinheiro lançadas no caixa.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-2 leading-relaxed">
              Ao sair sem concluir a venda, os pagamentos registrados nesta tela serão cancelados.
              Certifique-se de <strong>estornar fisicamente o dinheiro da gaveta</strong> ao cliente.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmacaoGaveta(false)}
              >
                Voltar ao Pagamento
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setShowConfirmacaoGaveta(false);
                  onClose();
                }}
              >
                Descartar e Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal C11: Dividir a Conta (Split Payment) */}
      <ModalSplitPayment
        isOpen={isSplitOpen}
        onClose={() => setIsSplitOpen(false)}
        comanda={comanda}
        onAplicarCota={handleAplicarCotaSplit}
      />
    </div>
  );
};
