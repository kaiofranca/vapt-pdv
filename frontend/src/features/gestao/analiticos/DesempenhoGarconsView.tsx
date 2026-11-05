import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  RefreshCw,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Trophy,
  CircleDollarSign,
  UserCheck,
} from 'lucide-react';
import { obterDesempenhoGarcons } from '../../../services/gestao';
import type { ItemDesempenhoGarcom } from '../../../types/api';
import { formatCurrency, cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface DesempenhoGarconsViewProps {
  onAbrirExportacao?: () => void;
}

export const DesempenhoGarconsView: React.FC<DesempenhoGarconsViewProps> = ({
  onAbrirExportacao,
}) => {
  const [buscaNome, setBuscaNome] = useState<string>('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['gestao', 'desempenho-garcons'],
    queryFn: () => obterDesempenhoGarcons(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const garcons = data?.garcons ?? [];

  // Ordenação decrescente por total vendido
  const garconsOrdenados = useMemo(() => {
    return [...garcons].sort((a, b) => {
      const vA = parseFloat(a.total_vendido || '0');
      const vB = parseFloat(b.total_vendido || '0');
      return vB - vA;
    });
  }, [garcons]);

  // Cálculos de destaque no topo
  const metricasGerais = useMemo(() => {
    if (garcons.length === 0) {
      return {
        totalVendidoEquipe: 0,
        totalComissaoEquipe: 0,
        totalComandas: 0,
        topVendedor: null as ItemDesempenhoGarcom | null,
        topComissao: null as ItemDesempenhoGarcom | null,
      };
    }

    let vendido = 0;
    let comissao = 0;
    let comandas = 0;

    let melhorVendedor = garcons[0];
    let maiorComissao = garcons[0];

    garcons.forEach((g) => {
      const v = parseFloat(g.total_vendido || '0');
      const c = parseFloat(g.comissao_gerada || '0');
      vendido += v;
      comissao += c;
      comandas += g.comandas_atendidas;

      if (v > parseFloat(melhorVendedor.total_vendido || '0')) {
        melhorVendedor = g;
      }
      if (c > parseFloat(maiorComissao.comissao_gerada || '0')) {
        maiorComissao = g;
      }
    });

    return {
      totalVendidoEquipe: vendido,
      totalComissaoEquipe: comissao,
      totalComandas: comandas,
      topVendedor: melhorVendedor,
      topComissao: maiorComissao,
    };
  }, [garcons]);

  // Filtro de busca local
  const garconsFiltrados = useMemo(() => {
    if (!buscaNome.trim()) return garconsOrdenados;
    const termo = buscaNome.toLowerCase();
    return garconsOrdenados.filter((g) =>
      g.garcom_nome.toLowerCase().includes(termo)
    );
  }, [garconsOrdenados, buscaNome]);

  const obterIniciais = (nome: string): string => {
    if (!nome) return 'GA';
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-brand-text">
              <Users className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-black text-text tracking-tight">
              Desempenho de Garçons
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M11
            </span>
          </div>
          <p className="text-sm text-text-2 mt-1">
            Auditoria da produtividade no atendimento de salão, volume de vendas e repasse de taxa de serviço (10%).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onAbrirExportacao && (
            <Button
              variant="outline"
              size="md"
              onClick={onAbrirExportacao}
              leftIcon={<FileSpreadsheet className="w-4 h-4" />}
            >
              Exportar
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            disabled={isFetching}
            leftIcon={
              <RefreshCw
                className={cn('w-4 h-4', isFetching && 'animate-spin text-brand')}
              />
            }
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Destaque no Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Top Faturamento */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-brand/40 shadow-soft p-5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-brand" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-2 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-brand" /> Maior Faturamento
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-soft text-brand-text">
              1º Lugar
            </span>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-text truncate">
              {metricasGerais.topVendedor?.garcom_nome || '—'}
            </div>
            <div className="text-2xl font-black text-brand-text tabular-nums mt-1">
              {formatCurrency(metricasGerais.topVendedor?.total_vendido || '0')}
            </div>
            <div className="text-xs text-text-2 mt-1">
              {metricasGerais.topVendedor?.comandas_atendidas ?? 0} comandas atendidas
            </div>
          </div>
        </div>

        {/* Card 2: Maior Comissão Gerada */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-success/40 shadow-soft p-5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-success" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-2 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDollarSign className="w-4 h-4 text-success" /> Maior Comissão (10%)
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-soft text-success-text">
              Destaque Gorjeta
            </span>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-text truncate">
              {metricasGerais.topComissao?.garcom_nome || '—'}
            </div>
            <div className="text-2xl font-black text-success-text tabular-nums mt-1">
              {formatCurrency(metricasGerais.topComissao?.comissao_gerada || '0')}
            </div>
            <div className="text-xs text-text-2 mt-1">
              Ticket médio: {formatCurrency(metricasGerais.topComissao?.ticket_medio || '0')}
            </div>
          </div>
        </div>

        {/* Card 3: Resumo Geral da Equipe */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-border shadow-soft p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-2 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-text-2" /> Total da Equipe
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-2 text-text-2">
              {garcons.length} atendentes
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-text tabular-nums">
              {formatCurrency(metricasGerais.totalVendidoEquipe)}
            </div>
            <div className="flex items-center justify-between text-xs text-text-2 mt-1">
              <span>{metricasGerais.totalComandas} comandas totais</span>
              <span className="font-semibold text-success-text">
                Comissões: {formatCurrency(metricasGerais.totalComissaoEquipe)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtro / Busca */}
      <div className="rounded-card bg-surface border border-border p-4 shadow-soft">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-text-2 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            value={buscaNome}
            onChange={(e) => setBuscaNome(e.target.value)}
            placeholder="Buscar por nome do garçom..."
            className="w-full h-11 pl-10 pr-4 rounded-input bg-surface-2 border border-border text-text placeholder:text-text-2/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
          />
        </div>
      </div>

      {/* Tabela de Desempenho */}
      <div className="rounded-card bg-surface border border-border shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-6 bg-surface-2 rounded-md animate-pulse w-48" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-2/60 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
            <h3 className="text-base font-bold text-text">Erro ao carregar desempenho</h3>
            <p className="text-sm text-text-2 mt-1 max-w-md mx-auto">
              {(error as Error)?.message || 'Não foi possível comunicar com o serviço de gestão.'}
            </p>
            <Button variant="secondary" size="md" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : garconsFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-text-2/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-text">Nenhum atendimento registrado</h3>
            <p className="text-sm text-text-2 mt-1">
              Não há dados de comandas atendidas para a equipe no período consultado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs font-bold text-text-2 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4 w-14 text-center">#</th>
                  <th scope="col" className="py-3 px-4">Garçom</th>
                  <th scope="col" className="py-3 px-4 text-center">Comandas Atendidas</th>
                  <th scope="col" className="py-3 px-4 text-right">Faturamento Total</th>
                  <th scope="col" className="py-3 px-4 text-right">Ticket Médio</th>
                  <th scope="col" className="py-3 px-4 text-right">Comissão 10%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {garconsFiltrados.map((garcom: ItemDesempenhoGarcom, index: number) => {
                  const posicao = index + 1;
                  return (
                    <tr
                      key={garcom.garcom_id}
                      className="hover:bg-surface-2/40 transition-colors duration-100"
                    >
                      {/* Posição / Ranking */}
                      <td className="py-3.5 px-4 text-center">
                        {posicao <= 3 ? (
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-soft',
                              posicao === 1 && 'bg-brand text-on-brand',
                              posicao === 2 && 'bg-surface-2 text-text border border-border-strong',
                              posicao === 3 && 'bg-amber-700/20 text-amber-900 dark:text-amber-300 border border-amber-600/30'
                            )}
                          >
                            {posicao}º
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-text-2 tabular-nums">
                            {posicao}º
                          </span>
                        )}
                      </td>

                      {/* Garçom com Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-surface-2 text-text-2 border border-border flex items-center justify-center text-xs font-bold shrink-0">
                            {obterIniciais(garcom.garcom_nome)}
                          </span>
                          <div>
                            <div className="font-bold text-text">{garcom.garcom_nome}</div>
                            <div className="text-[11px] text-text-2">ID: #{garcom.garcom_id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Comandas Atendidas */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-2 text-text border border-border tabular-nums">
                          {garcom.comandas_atendidas} comandas
                        </span>
                      </td>

                      {/* Faturamento Total */}
                      <td className="py-3.5 px-4 text-right font-black text-text tabular-nums text-base">
                        {formatCurrency(garcom.total_vendido)}
                      </td>

                      {/* Ticket Médio */}
                      <td className="py-3.5 px-4 text-right font-semibold text-text-2 tabular-nums">
                        {formatCurrency(garcom.ticket_medio)}
                      </td>

                      {/* Comissão 10% */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-success-soft text-success-text border border-success/30 tabular-nums">
                          {formatCurrency(garcom.comissao_gerada)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé com totais consolidados */}
        {!isLoading && !isError && garconsFiltrados.length > 0 && (
          <div className="p-4 bg-surface-2/60 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-2 gap-2">
            <span>
              Total de <strong>{garconsFiltrados.length}</strong> garçons listados
            </span>
            <div className="flex items-center gap-4">
              <span>
                Total Faturado: <strong className="text-text tabular-nums">{formatCurrency(metricasGerais.totalVendidoEquipe)}</strong>
              </span>
              <span>
                Total em Gorjetas: <strong className="text-success-text tabular-nums">{formatCurrency(metricasGerais.totalComissaoEquipe)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
