import React, { useMemo, useState, useEffect } from 'react';
import { Printer, Receipt, Check, ShieldCheck } from 'lucide-react';
import type { Comanda, ItemComanda } from '../../../types/api';
import { formatCurrency } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';
import type { ParcelaPagamento } from './ComprovanteVenda';
import {
  caixaSatApi,
  type ReciboCompletoResposta,
} from '../api/caixaSatApi';

export interface ReciboPaperViewProps {
  comanda: Comanda;
  parcelas?: ParcelaPagamento[];
  nomeOperador?: string;
  documentoCliente?: string;
  codigoAutenticacao?: string;
  onNovaVenda?: () => void;
  onFechar?: () => void;
  exibirAcoes?: boolean;
  paperText?: string;
  reciboOficial?: ReciboCompletoResposta | null;
}

/**
 * Gera um código de autenticação único do comprovante em fallback
 * Padrão: VAPT-YYYYMMDD-M{mesa}-{hash}
 */
export function gerarCodigoAutenticacao(comanda: Comanda): string {
  const data = comanda.paga_em ? new Date(comanda.paga_em) : new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  const mesaStr = String(comanda.mesa || '0').padStart(2, '0');

  // Hash determinístico de 4 caracteres hexadecimais
  const seed = (comanda.id * 997 + parseInt(mesaStr, 10) * 31 + (data.getTime() % 10000)) & 0xffff;
  const hash = seed.toString(16).toUpperCase().padStart(4, '0');

  return `VAPT-${ano}${mes}${dia}-M${mesaStr}-${hash}`;
}

/**
 * Componente C12 - Recibo Térmico Operacional (.paper)
 * Visual de bobina térmica com fundo branco fixo, bordas serrilhadas estilizadas,
 * tipografia tabular monospace de 48 colunas canônica retornada pelo satélite :3002.
 */
export const ReciboPaperView: React.FC<ReciboPaperViewProps> = ({
  comanda,
  parcelas = [],
  nomeOperador = 'Caixa 01',
  documentoCliente,
  codigoAutenticacao,
  onNovaVenda,
  onFechar,
  exibirAcoes = true,
  paperText,
  reciboOficial,
}) => {
  const [reciboCarregado, setReciboCarregado] = useState<ReciboCompletoResposta | null>(null);

  // Busca recibo canônico no satélite :3002 caso não tenha sido injetado via props
  useEffect(() => {
    if (!paperText && !reciboOficial && comanda?.id) {
      caixaSatApi
        .obterRecibo(comanda.id)
        .then((res) => setReciboCarregado(res))
        .catch(() => {
          // Fallback gracioso silencioso para renderização estruturada local
        });
    }
  }, [paperText, reciboOficial, comanda?.id]);

  const itens: ItemComanda[] = useMemo(() => comanda.itens || [], [comanda]);

  const codigoFinal = useMemo(() => {
    return (
      reciboOficial?.codigo_autenticacao ||
      reciboCarregado?.codigo_autenticacao ||
      codigoAutenticacao ||
      gerarCodigoAutenticacao(comanda)
    );
  }, [reciboOficial, reciboCarregado, codigoAutenticacao, comanda]);

  const dataFormatada = useMemo(() => {
    const d = comanda.paga_em ? new Date(comanda.paga_em) : new Date();
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [comanda.paga_em]);

  const handleImprimir = () => {
    window.print();
  };

  const totalCalculadoCentavos = useMemo(() => {
    if (parcelas.length > 0) {
      return parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
    }
    const val = parseFloat(comanda.total || comanda.subtotal || '0');
    return Math.round(val * 100);
  }, [parcelas, comanda]);

  const trocoTotalCentavos = useMemo(() => {
    return parcelas.reduce((acc, p) => acc + (p.trocoCentavos || 0), 0);
  }, [parcelas]);

  // Texto térmico .paper de 48 colunas retornado pelo satélite ou gerado em fallback
  const textoPaper = useMemo(() => {
    if (paperText) return paperText;
    if (reciboOficial?.paper_text) return reciboOficial.paper_text;
    if (reciboCarregado?.paper_text) return reciboCarregado.paper_text;
    return null;
  }, [paperText, reciboOficial, reciboCarregado]);

  return (
    <div className="flex flex-col items-center justify-center p-2 text-[#2B2019]">
      {/* Estilos dedicados para impressão térmica e borda serrilhada */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #recibo-paper-print, #recibo-paper-print * {
            visibility: visible !important;
          }
          #recibo-paper-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 6px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }

        /* Borda serrilhada superior e inferior da bobina térmica (.paper) */
        .paper-sawtooth-top {
          background: radial-gradient(circle at 10px -5px, transparent 12px, #ffffff 13px) repeat-x;
          background-size: 20px 10px;
          height: 10px;
          width: 100%;
        }
        .paper-sawtooth-bottom {
          background: radial-gradient(circle at 10px 15px, transparent 12px, #ffffff 13px) repeat-x;
          background-size: 20px 10px;
          height: 10px;
          width: 100%;
        }
      `}</style>

      {/* Recipiente da Bobina .paper com fundo branco fixo */}
      <div className="w-full max-w-[380px] filter drop-shadow-md">
        {/* Borda serrilhada do topo da folha */}
        <div className="paper-sawtooth-top rounded-t-sm" aria-hidden="true" />

        <div
          id="recibo-paper-print"
          data-testid="recibo-paper-container"
          className="bg-white text-[#2B2019] px-4 py-4 font-mono text-xs select-none border-x border-gray-200"
        >
          {paperText ? (
            <div className="space-y-3">
              <pre
                data-testid="recibo-paper-text"
                className="font-mono text-[11px] leading-snug whitespace-pre select-all text-[#2B2019] overflow-x-auto"
              >
                {paperText}
              </pre>
              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 font-semibold mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
                  <span>AUTENTICAÇÃO DO COMPROVANTE</span>
                </div>
                <span
                  data-testid="codigo-autenticacao-recibo"
                  className="text-xs font-black tracking-widest text-[#2B2019] block select-all tabular-nums"
                >
                  {codigoFinal}
                </span>
              </div>
            </div>
          ) : (
            <>

          {/* Exibição Canônica de 48 colunas .paper se texto estiver disponível */}
          {textoPaper ? (
            <div className="space-y-3">
              <pre
                data-testid="recibo-paper-text"
                className="font-mono text-[11px] leading-snug whitespace-pre select-all text-[#2B2019] overflow-x-auto"
              >
                {textoPaper}
              </pre>

              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 font-semibold mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
                  <span>AUTENTICAÇÃO DO COMPROVANTE</span>
                </div>
                <span
                  className="text-xs font-black tracking-widest text-[#2B2019] block select-all tabular-nums"
                  data-testid="codigo-autenticacao-recibo"
                >
                  {codigoFinal}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Cabeçalho do Recibo Local */}
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex items-center justify-center gap-1.5 font-sans font-black text-sm tracking-tight text-[#2B2019]">
                  <Receipt className="w-4 h-4 text-[#F2A81D]" />
                  <span>VAPTPDV OPERAÇÕES S.A.</span>
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5">Ecossistema Integrado de Ponto de Venda</p>
                <p className="text-[10px] font-bold text-gray-800 mt-1 uppercase tracking-wider">
                  Comprovante de Venda e Consumo
                </p>

                <div className="mt-2.5 pt-2 border-t border-dotted border-gray-300 text-[11px] text-gray-700 flex justify-between">
                  <span>DATA: {dataFormatada}</span>
                  <span className="font-bold">MESA: {comanda.mesa}</span>
                </div>

                <div className="text-[11px] text-gray-700 flex justify-between mt-0.5">
                  <span>COMANDA: #{comanda.id}</span>
                  <span>OPERADOR: {nomeOperador}</span>
                </div>

                {documentoCliente && (
                  <div className="text-[11px] text-gray-700 text-left mt-0.5 font-semibold">
                    <span>CLIENTE / CPF: {documentoCliente}</span>
                  </div>
                )}
              </div>

              {/* Lista de Itens Consumidos */}
              <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex justify-between font-bold text-[10px] uppercase text-gray-500 mb-1">
                  <span>QTD ITEM</span>
                  <span>VALOR</span>
                </div>
                <div className="space-y-1">
                  {itens.length > 0 ? (
                    itens.map((it) => {
                      const unit = parseFloat(it.preco_copiado || '0');
                      const sub = unit * it.quantidade;
                      return (
                        <div key={it.id} className="flex justify-between items-baseline text-[11px]">
                          <span className="truncate pr-2">
                            {it.quantidade}x {it.nome_copiado}
                          </span>
                          <span className="tabular-nums font-bold shrink-0">
                            {formatCurrency(sub)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-[10px] text-gray-500 py-1">
                      Itens não especificados
                    </div>
                  )}
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-700">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(comanda.subtotal || totalCalculadoCentavos / 100)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>TAXA DE SERVIÇO (10%):</span>
                  <span className="tabular-nums font-bold">
                    {formatCurrency(comanda.taxa_servico || '0.00')}
                  </span>
                </div>
                <div className="flex justify-between items-baseline font-bold text-sm text-[#2B2019] pt-1 border-t border-gray-300">
                  <span>TOTAL QUITADO:</span>
                  <span className="tabular-nums text-base font-black">
                    {formatCurrency(comanda.total || totalCalculadoCentavos / 100)}
                  </span>
                </div>
              </div>

              {/* Pagamentos Registrados e Troco */}
              <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-[11px] space-y-1">
                <span className="font-bold uppercase text-[10px] text-gray-500 block mb-0.5">
                  Detalhamento dos Pagamentos:
                </span>
                {parcelas.length > 0 ? (
                  parcelas.map((parc, index) => {
                    const rotulo =
                      parc.forma === 'dinheiro'
                        ? 'Dinheiro em Espécie'
                        : parc.forma === 'pix'
                        ? 'Pix QR Code'
                        : parc.subtipo === 'debito'
                        ? 'Cartão Débito'
                        : 'Cartão Crédito';

                    return (
                      <div key={index} className="flex justify-between items-baseline">
                        <span>{rotulo}:</span>
                        <span className="tabular-nums font-bold">
                          {formatCurrency(parc.valorCentavos / 100)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex justify-between items-baseline">
                    <span className="capitalize">{comanda.forma_pagamento || 'Quitação Integral'}:</span>
                    <span className="tabular-nums font-bold">
                      {formatCurrency(comanda.total || totalCalculadoCentavos / 100)}
                    </span>
                  </div>
                )}

                {trocoTotalCentavos > 0 && (
                  <div className="flex justify-between text-[#1F6B3E] font-bold pt-1 border-t border-dotted border-gray-300">
                    <span>TROCO DEVOLVIDO:</span>
                    <span className="tabular-nums font-black">
                      {formatCurrency(trocoTotalCentavos / 100)}
                    </span>
                  </div>
                )}
              </div>

              {/* Código de Autenticação Único */}
              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-center mb-3">
                <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 font-semibold mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
                  <span>AUTENTICAÇÃO DO COMPROVANTE</span>
                </div>
                <span
                  className="text-xs font-black tracking-widest text-[#2B2019] block select-all tabular-nums"
                  data-testid="codigo-autenticacao-recibo"
                >
                  {codigoFinal}
                </span>
              </div>

              {/* Rodapé Legal */}
              <div className="text-center text-[9px] text-gray-500 space-y-0.5">
                <p className="font-semibold uppercase tracking-wider">
                  Documento Auxiliar de Venda · Sem Valor Fiscal
                </p>
                <p>Agradecemos a preferência · Volte Sempre!</p>
              </div>
            </>
          )}
            </>
          )}
        </div>

        {/* Borda serrilhada inferior da folha */}
        <div className="paper-sawtooth-bottom rounded-b-sm" aria-hidden="true" />
      </div>

      {/* Ações (Imprimir Recibo e Concluir/Nova Venda) */}
      {exibirAcoes && (
        <div className="flex flex-col sm:flex-row gap-3 mt-5 w-full max-w-[380px]">
          <Button
            variant="outline"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handleImprimir}
            className="flex-1 min-h-[44px] text-xs font-bold"
          >
            Imprimir Recibo
          </Button>
          {onNovaVenda && (
            <Button
              variant="primary"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={onNovaVenda}
              className="flex-1 min-h-[44px] text-xs font-bold"
            >
              Nova Venda
            </Button>
          )}
          {!onNovaVenda && onFechar && (
            <Button
              variant="secondary"
              onClick={onFechar}
              className="flex-1 min-h-[44px] text-xs font-bold"
            >
              Fechar
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
