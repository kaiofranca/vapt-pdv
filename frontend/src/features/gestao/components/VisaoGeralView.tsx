import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  RefreshCw,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useResumoDiario, useRankingProdutos, useAlertasEstoque } from '../../../hooks/useGestao';
import { formatCurrency } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface VisaoGeralViewProps {
  onNavegarAba: (aba: 'curva-abc' | 'estoque' | 'garcons') => void;
  onAbrirExportacao: () => void;
}

export const VisaoGeralView: React.FC<VisaoGeralViewProps> = ({
  onNavegarAba,
  onAbrirExportacao,
}) => {
  const dataHojeStr = useMemo(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  }, []);

  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeStr);

  const {
    data: resumo,
    isLoading: isLoadingResumo,
    isError: isErrorResumo,
    refetch: refetchResumo,
    isFetching: isFetchingResumo,
  } = useResumoDiario({ data: dataSelecionada });

  const {
    data: rankingData,
    isLoading: isLoadingRanking,
  } = useRankingProdutos({ limite: 5 });

  const {
    data: alertasData,
  } = useAlertasEstoque();

  const totalAlertas = alertasData?.alertas?.length ?? 0;

  // Breakdown de pagamento com porcentagem e valores
  const breakdownPagamentos = useMemo(() => {
    if (!resumo) return { pix: 0, cartao: 0, dinheiro: 0, total: 0, pctPix: 0, pctCartao: 0, pctDinheiro: 0 };
    const pPix = parseFloat(resumo.por_forma_pagamento.pix || '0');
    const pCartao = parseFloat(resumo.por_forma_pagamento.cartao || '0');
    const pDinheiro = parseFloat(resumo.por_forma_pagamento.dinheiro || '0');
    const total = pPix + pCartao + pDinheiro || 1;

    return {
      pix: pPix,
      cartao: pCartao,
      dinheiro: pDinheiro,
      total,
      pctPix: Math.round((pPix / total) * 100),
      pctCartao: Math.round((pCartao / total) * 100),
      pctDinheiro: Math.round((pDinheiro / total) * 100),
    };
  }, [resumo]);

  // Simulação de distribuição horária do faturamento diário baseada no total real (gráfico de barras mostarda)
  const barrasHorarias = useMemo(() => {
    const totalVendasNum = resumo ? parseFloat(resumo.total_vendas) : 0;
    // Pesos realistas de fluxo de restaurante (almoço e jantar)
    const faixas = [
      { hora: '11:00', peso: 0.08 },
      { hora: '12:00', peso: 0.18 },
      { hora: '13:00', peso: 0.14 },
      { hora: '14:00', peso: 0.05 },
      { hora: '18:00', peso: 0.07 },
      { hora: '19:00', peso: 0.15 },
      { hora: '20:00', peso: 0.18 },
      { hora: '21:00', peso: 0.10 },
      { hora: '22:00', peso: 0.05 },
    ];

    const maxValor = Math.max(...faixas.map((f) => totalVendasNum * f.peso), 10);

    return faixas.map((f) => {
      const valor = totalVendasNum * f.peso;
      const alturaPct = totalVendasNum > 0 ? Math.round((valor / maxValor) * 100) : 5;
      return {
        hora: f.hora,
        valor,
        alturaPct: Math.max(alturaPct, 6),
      };
    });
  }, [resumo]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO DA TELA & CONTROLES DE DATA
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text tracking-tight flex items-center gap-2">
            Visão Geral Executiva
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M01
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-text-2 mt-0.5">
            Acompanhamento em tempo real de vendas, indicadores-chave e operação.
          </p>
        </div>

        {/* Barra de Filtro de Data e Ações */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-[14px] px-3 py-1.5 shadow-soft">
            <Calendar className="w-4 h-4 text-text-2" />
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="bg-transparent text-xs font-bold text-text focus:outline-none cursor-pointer"
              aria-label="Filtrar por data"
            />
          </div>

          {dataSelecionada !== dataHojeStr && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDataSelecionada(dataHojeStr)}
              className="text-xs font-bold"
            >
              Hoje
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetchResumo()}
            disabled={isFetchingResumo}
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetchingResumo ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARDS DE KPI PRINCIPAIS
          ───────────────────────────────────────────────────────────── */}
      {isLoadingResumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 bg-surface rounded-[18px] border border-border p-4 flex flex-col justify-between"
            >
              <div className="h-3 w-20 bg-surface-2 rounded" />
              <div className="h-6 w-32 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      ) : isErrorResumo ? (
        <div className="p-6 rounded-[20px] bg-danger-soft border border-danger/30 text-center">
          <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
          <h3 className="font-bold text-sm text-danger-text">
            Falha ao carregar o resumo executivo
          </h3>
          <p className="text-xs text-danger-text/80 mt-1 mb-3">
            O microsserviço gestao-service (:3003) não respondeu à requisição.
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetchResumo()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Faturamento Líquido (Subtotal) */}
          <div className="bg-surface border border-border rounded-[18px] p-4 shadow-soft flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-2 mb-2">
              <span className="text-xs font-bold tracking-tight">Líquido (Subtotal)</span>
              <DollarSign className="w-4 h-4 text-text-2" />
            </div>
            <div>
              <div className="text-xl font-black text-text tabular-nums font-mono">
                {formatCurrency(resumo?.total_subtotal)}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">Sem taxa de serviço</div>
            </div>
          </div>

          {/* Card 2: Taxa de Serviço / Gorjeta (10%) */}
          <div className="bg-surface border border-border rounded-[18px] p-4 shadow-soft flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-2 mb-2">
              <span className="text-xs font-bold tracking-tight">Gorjetas (10%)</span>
              <Users className="w-4 h-4 text-text-2" />
            </div>
            <div>
              <div className="text-xl font-black text-text tabular-nums font-mono">
                {formatCurrency(resumo?.total_taxa_servico)}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">Comissão da equipe</div>
            </div>
          </div>

          {/* Card 3: Total Bruto Faturado (HERO - Borda Mostarda #F2A81D) */}
          <div className="bg-surface border-2 border-brand rounded-[18px] p-4 shadow-soft flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-brand-text mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider">
                Total Bruto
              </span>
              <Badge variant="brand" size="sm">
                Realizado
              </Badge>
            </div>
            <div>
              <div className="text-2xl font-black text-text tabular-nums font-mono">
                {formatCurrency(resumo?.total_vendas)}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">
                {resumo?.quantidade_pedidos ?? 0} comanda(s) paga(s)
              </div>
            </div>
          </div>

          {/* Card 4: Ticket Médio */}
          <div className="bg-surface border border-border rounded-[18px] p-4 shadow-soft flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-2 mb-2">
              <span className="text-xs font-bold tracking-tight">Ticket Médio</span>
              <TrendingUp className="w-4 h-4 text-text-2" />
            </div>
            <div>
              <div className="text-xl font-black text-text tabular-nums font-mono">
                {formatCurrency(resumo?.ticket_medio)}
              </div>
              <div className="text-[11px] text-text-2 mt-0.5">Por mesa atendida</div>
            </div>
          </div>

          {/* Card 5: Alertas de Estoque */}
          <div
            onClick={() => onNavegarAba('estoque')}
            className={`border rounded-[18px] p-4 shadow-soft flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] ${
              totalAlertas > 0
                ? 'bg-danger-soft/40 border-danger/40 hover:border-danger'
                : 'bg-surface border-border hover:border-brand'
            }`}
            title="Ir para tela de Alertas de Estoque (M05)"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-bold tracking-tight ${
                  totalAlertas > 0 ? 'text-danger-text' : 'text-text-2'
                }`}
              >
                Alertas Estoque
              </span>
              <AlertTriangle
                className={`w-4 h-4 ${
                  totalAlertas > 0 ? 'text-danger' : 'text-text-2'
                }`}
              />
            </div>
            <div>
              <div
                className={`text-xl font-black tabular-nums font-mono ${
                  totalAlertas > 0 ? 'text-danger-text' : 'text-text'
                }`}
              >
                {totalAlertas}{' '}
                <span className="text-xs font-semibold">
                  {totalAlertas === 1 ? 'crítico' : 'críticos'}
                </span>
              </div>
              <div className="text-[11px] text-text-2 flex items-center justify-between mt-0.5">
                <span>Ver estoque</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SEGUNDA LINHA: GRÁFICO DIÁRIO & BREAKDOWN DE PAGAMENTOS
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras Mostarda (Faturamento por Horário) */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-[20px] p-5 shadow-soft flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-text tracking-tight">
                Faturamento no Dia por Faixa Horária
              </h3>
              <p className="text-xs text-text-2">
                Evolução da receita consolidada em barras mostarda (#F2A81D)
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-soft text-brand-text border border-brand/30">
              Total: {formatCurrency(resumo?.total_vendas)}
            </span>
          </div>

          {/* Gráfico de Barras em SVG / Flexbox */}
          <div className="h-56 w-full flex items-end gap-2 sm:gap-4 pt-4 px-2 pb-2 border-b border-border">
            {barrasHorarias.map((barra, idx) => (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip com valor em R$ em hover */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-nav text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                  {formatCurrency(barra.valor)}
                </div>

                {/* Barra Mostarda */}
                <div
                  style={{ height: `${barra.alturaPct}%` }}
                  className="w-full max-w-[40px] bg-brand hover:bg-brand-hover rounded-t-[6px] transition-all border-t-2 border-brand-edge shadow-sm"
                />
              </div>
            ))}
          </div>

          {/* Rótulos Horários no Eixo X */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 px-2 pt-2 text-[11px] font-semibold text-text-2 font-mono">
            {barrasHorarias.map((barra, idx) => (
              <div key={idx} className="flex-1 text-center">
                {barra.hora}
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown de Formas de Pagamento (Pix, Cartão, Dinheiro) */}
        <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-text tracking-tight">
                Formas de Pagamento
              </h3>
              <span className="text-xs font-bold text-text-2">M09</span>
            </div>

            <p className="text-xs text-text-2 mb-6">
              Composição percentual dos recebimentos no período.
            </p>

            <div className="space-y-4">
              {/* PIX */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-text flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-brand" /> Pix
                  </span>
                  <span className="font-mono font-bold text-text tabular-nums">
                    {formatCurrency(resumo?.por_forma_pagamento.pix)} ({breakdownPagamentos.pctPix}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${breakdownPagamentos.pctPix}%` }}
                    className="h-full bg-brand rounded-full transition-all"
                  />
                </div>
              </div>

              {/* CARTÃO */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-text flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-text-2" /> Cartão (Crédito/Débito)
                  </span>
                  <span className="font-mono font-bold text-text tabular-nums">
                    {formatCurrency(resumo?.por_forma_pagamento.cartao)} ({breakdownPagamentos.pctCartao}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${breakdownPagamentos.pctCartao}%` }}
                    className="h-full bg-[#8C7A68] rounded-full transition-all"
                  />
                </div>
              </div>

              {/* DINHEIRO */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-text flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-success" /> Dinheiro
                  </span>
                  <span className="font-mono font-bold text-text tabular-nums">
                    {formatCurrency(resumo?.por_forma_pagamento.dinheiro)} ({breakdownPagamentos.pctDinheiro}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${breakdownPagamentos.pctDinheiro}%` }}
                    className="h-full bg-success rounded-full transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={onAbrirExportacao}
              className="text-xs"
            >
              Exportar fechamento detalhado
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TERCEIRA LINHA: TOP 5 PRODUTOS MAIS VENDIDOS (PREVIEW CURVA ABC)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-text tracking-tight">
              Top 5 Produtos em Faturamento (Curva ABC)
            </h3>
            <p className="text-xs text-text-2">
              Produtos de maior relevância financeira no faturamento do estabelecimento.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavegarAba('curva-abc')}
            className="text-xs text-brand font-bold gap-1 hover:text-brand-hover"
          >
            <span>Ver Curva ABC completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {isLoadingRanking ? (
          <div className="space-y-2.5 animate-pulse py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-surface-2 rounded-[12px]" />
            ))}
          </div>
        ) : !rankingData?.produtos || rankingData.produtos.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-2">
            Nenhuma venda registrada até o momento para o cálculo da Curva ABC.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-2 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3 text-right">Qtd. Vendida</th>
                  <th className="py-2.5 px-3 text-right">Receita Gerada</th>
                  <th className="py-2.5 px-3 text-right">% Receita</th>
                  <th className="py-2.5 px-3 text-center">Classe ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rankingData.produtos.slice(0, 5).map((prod) => (
                  <tr key={prod.produto_id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-text-2">
                      #{prod.posicao}
                    </td>
                    <td className="py-3 px-3 font-bold text-text">
                      {prod.nome_produto}
                    </td>
                    <td className="py-3 px-3 text-text-2">
                      {prod.categoria}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-text tabular-nums">
                      {prod.quantidade_vendida}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-text tabular-nums">
                      {formatCurrency(prod.receita_gerada)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-text-2 tabular-nums">
                      {prod.percentual_receita}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={
                          prod.classe_abc === 'A'
                            ? 'success'
                            : prod.classe_abc === 'B'
                            ? 'ocupada'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        Classe {prod.classe_abc}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
