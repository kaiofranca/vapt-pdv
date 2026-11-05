import React, { useMemo } from 'react';
import { Users, Award, RefreshCw, AlertCircle, DollarSign } from 'lucide-react';
import { useDesempenhoGarcons } from '../../../hooks/useGestao';
import { formatCurrency } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export const DesempenhoGarconsView: React.FC = () => {
  const {
    data: garconsData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useDesempenhoGarcons();

  const obterIniciais = (nome: string): string => {
    if (!nome) return 'GA';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].slice(0, 2).toUpperCase();
  };

  // Garçons ordenados por volume total vendido decrescente
  const garconsOrdenados = useMemo(() => {
    if (!garconsData?.garcons) return [];
    return [...garconsData.garcons].sort(
      (a, b) => parseFloat(b.total_vendido) - parseFloat(a.total_vendido),
    );
  }, [garconsData]);

  // Totais consolidados da equipe
  const totaisEquipe = useMemo(() => {
    if (!garconsOrdenados.length) {
      return { comandas: 0, vendido: 0, comissao: 0 };
    }
    let totalComandas = 0;
    let totalVendido = 0;
    let totalComissao = 0;

    garconsOrdenados.forEach((g) => {
      totalComandas += g.comandas_atendidas;
      totalVendido += parseFloat(g.total_vendido || '0');
      totalComissao += parseFloat(g.comissao_gerada || '0');
    });

    return {
      comandas: totalComandas,
      vendido: totalVendido,
      comissao: totalComissao,
    };
  }, [garconsOrdenados]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO & ATUALIZAÇÃO
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text tracking-tight flex items-center gap-2">
            Desempenho da Equipe e Comissões
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M11
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-text-2 mt-0.5">
            Produtividade no salão, volume de vendas e taxa de serviço (10%) gerada por colaborador.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar Equipe
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARDS DE RESUMO DA EQUIPE
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
          <div className="flex items-center justify-between text-text-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Comandas Atendidas
            </span>
            <Users className="w-4 h-4 text-text-2" />
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {totaisEquipe.comandas}
          </div>
          <div className="text-xs text-text-2 mt-1">Total acumulado da equipe</div>
        </div>

        <div className="bg-surface border-2 border-brand rounded-[20px] p-5 shadow-soft">
          <div className="flex items-center justify-between text-brand-text mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Total Vendido pela Equipe
            </span>
            <DollarSign className="w-4 h-4 text-brand-text" />
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {formatCurrency(totaisEquipe.vendido)}
          </div>
          <div className="text-xs text-text-2 mt-1">Faturamento bruto gerado</div>
        </div>

        <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
          <div className="flex items-center justify-between text-text-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total de Comissões (10%)
            </span>
            <Award className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono text-success">
            {formatCurrency(totaisEquipe.comissao)}
          </div>
          <div className="text-xs text-text-2 mt-1">Taxa de serviço a ratear</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESTAQUE TOP 3 GARÇONS
          ───────────────────────────────────────────────────────────── */}
      {garconsOrdenados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {garconsOrdenados.slice(0, 3).map((garcom, idx) => (
            <div
              key={garcom.garcom_id}
              className={`rounded-[20px] p-5 bg-surface border shadow-soft flex items-center gap-4 ${
                idx === 0 ? 'border-brand-edge bg-brand-soft/20' : 'border-border'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full font-black text-sm flex items-center justify-center shrink-0 shadow-soft ${
                  idx === 0
                    ? 'bg-brand text-on-brand'
                    : 'bg-surface-2 text-text border border-border'
                }`}
              >
                {obterIniciais(garcom.garcom_nome)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-extrabold text-sm text-text truncate">
                    {garcom.garcom_nome}
                  </span>
                  <Badge variant={idx === 0 ? 'brand' : 'neutral'} size="sm">
                    #{idx + 1}
                  </Badge>
                </div>
                <div className="text-xs font-mono font-bold text-text tabular-nums">
                  {formatCurrency(garcom.total_vendido)}
                </div>
                <div className="text-[11px] text-text-2 mt-0.5">
                  {garcom.comandas_atendidas} atendimentos · Comis: {formatCurrency(garcom.comissao_gerada)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABELA DETALHADA DE PRODUTIVIDADE
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text tracking-tight">
            Classificação Individual de Produtividade
          </h3>
          <span className="text-xs text-text-2 font-medium">
            Ordenado por maior faturamento
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-surface-2 rounded-[12px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center bg-danger-soft border border-danger/30 rounded-[16px]">
            <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
            <div className="text-sm font-bold text-danger-text">
              Erro ao carregar o desempenho da equipe
            </div>
            <p className="text-xs text-danger-text/80 mt-1 mb-3">
              Não foi possível comunicar com o endpoint /gestao/desempenho-garcons.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : garconsOrdenados.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-2">
            Nenhum registro de atendimento localizado no histórico.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-2 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Posição</th>
                  <th className="py-3 px-3">Garçom</th>
                  <th className="py-3 px-3 text-right">Comandas Atendidas</th>
                  <th className="py-3 px-3 text-right">Total Vendido</th>
                  <th className="py-3 px-3 text-right">Ticket Médio</th>
                  <th className="py-3 px-3 text-right">Comissão 10%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {garconsOrdenados.map((garcom, idx) => (
                  <tr key={garcom.garcom_id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-text-2">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-brand-soft text-brand-text font-black text-[10px] flex items-center justify-center shrink-0">
                          {obterIniciais(garcom.garcom_nome)}
                        </div>
                        <span className="font-bold text-text">
                          {garcom.garcom_nome}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-text tabular-nums">
                      {garcom.comandas_atendidas}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-text tabular-nums">
                      {formatCurrency(garcom.total_vendido)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-text tabular-nums">
                      {formatCurrency(garcom.ticket_medio)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-success tabular-nums">
                      {formatCurrency(garcom.comissao_gerada)}
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
