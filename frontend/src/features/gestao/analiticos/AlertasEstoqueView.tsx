import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Search,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Filter,
  Clock,
} from 'lucide-react';
import { obterAlertasEstoque } from '../../../services/gestao';
import type { ItemAlertaEstoque, NivelAlertaEstoque } from '../../../types/api';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface AlertasEstoqueViewProps {
  onAbrirExportacao?: () => void;
}

export const AlertasEstoqueView: React.FC<AlertasEstoqueViewProps> = ({
  onAbrirExportacao,
}) => {
  const [apenasAtivos, setApenasAtivos] = useState<boolean>(true);
  const [filtroNivel, setFiltroNivel] = useState<'todos' | NivelAlertaEstoque>('todos');
  const [buscaNome, setBuscaNome] = useState<string>('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['gestao', 'alertas-estoque', { apenas_ativos: apenasAtivos }],
    queryFn: () => obterAlertasEstoque({ apenas_ativos: apenasAtivos }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const alertas = data?.alertas ?? [];

  // Contadores para o banner
  const { totalZerados, totalBaixos } = useMemo(() => {
    let zerados = 0;
    let baixos = 0;
    alertas.forEach((a) => {
      if (a.nivel === 'zerado' || a.estoque_atual === 0) {
        zerados += 1;
      } else {
        baixos += 1;
      }
    });
    return { totalZerados: zerados, totalBaixos: baixos };
  }, [alertas]);

  // Filtros combinados
  const alertasFiltrados = useMemo(() => {
    return alertas.filter((item) => {
      // Filtro de nível
      if (filtroNivel !== 'todos' && item.nivel !== filtroNivel) {
        return false;
      }
      // Filtro de texto
      if (buscaNome.trim()) {
        const termo = buscaNome.toLowerCase();
        const corresponde =
          item.nome_produto.toLowerCase().includes(termo) ||
          item.categoria.toLowerCase().includes(termo);
        if (!corresponde) return false;
      }
      return true;
    });
  }, [alertas, filtroNivel, buscaNome]);

  const formatarData = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const dataObj = new Date(isoString);
      if (isNaN(dataObj.getTime())) return '—';
      return dataObj.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-danger-soft text-danger">
              <Package className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-black text-text tracking-tight">
              Alertas de Estoque
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M05
            </span>
          </div>
          <p className="text-sm text-text-2 mt-1">
            Monitoramento preventivo de insumos e produtos com estoque abaixo da margem mínima de segurança ou esgotados.
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

      {/* Banner de Alerta de Reposição Imediata */}
      {!isLoading && !isError && (
        <>
          {alertas.length > 0 ? (
            <div
              className={cn(
                'relative overflow-hidden rounded-card p-5 border shadow-soft transition-all duration-200',
                totalZerados > 0
                  ? 'bg-danger-soft/60 border-danger/40 text-danger-text'
                  : 'bg-brand-soft/70 border-brand/40 text-brand-text'
              )}
            >
              <div
                className={cn(
                  'absolute top-0 left-0 w-2 h-full',
                  totalZerados > 0 ? 'bg-danger' : 'bg-brand'
                )}
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0 mt-0.5',
                      totalZerados > 0
                        ? 'bg-danger text-white'
                        : 'bg-brand text-on-brand'
                    )}
                  >
                    {totalZerados > 0 ? (
                      <AlertOctagon className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight text-text">
                      Atenção: {alertas.length} {alertas.length === 1 ? 'item requer' : 'itens requerem'} reposição de estoque
                    </h3>
                    <p className="text-sm mt-0.5 opacity-90 text-text-2">
                      Existem{' '}
                      <strong className="text-danger font-black">
                        {totalZerados} {totalZerados === 1 ? 'produto esgotado' : 'produtos esgotados'} (saldo zero)
                      </strong>{' '}
                      e{' '}
                      <strong className="text-brand-text font-black">
                        {totalBaixos} {totalBaixos === 1 ? 'produto' : 'produtos'} abaixo do estoque mínimo
                      </strong>
                      . Providencie a reposição para evitar recusa de pedidos no salão.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-surface border border-border shadow-soft text-text">
                    {alertas.length} pendências
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-card p-5 bg-success-soft/60 border border-success/30 text-success-text shadow-soft flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success text-white shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">
                  Estoque em conformidade operacional
                </h3>
                <p className="text-xs text-text-2 mt-0.5">
                  Nenhum produto está atualmente abaixo do limite mínimo de segurança configurado.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="rounded-card bg-surface border border-border p-4 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Busca por texto */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-text-2 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              placeholder="Buscar por produto ou categoria em alerta..."
              className="w-full h-11 pl-10 pr-4 rounded-input bg-surface-2 border border-border text-text placeholder:text-text-2/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          {/* Filtro por Nível de Severidade */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-semibold text-text-2 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Nível:
            </span>
            <button
              onClick={() => setFiltroNivel('todos')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 min-h-[36px]',
                filtroNivel === 'todos'
                  ? 'bg-brand text-on-brand shadow-soft font-bold'
                  : 'bg-surface-2 text-text-2 hover:text-text hover:bg-border/50 border border-border/60'
              )}
            >
              Todos ({alertas.length})
            </button>
            <button
              onClick={() => setFiltroNivel('zerado')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 min-h-[36px]',
                filtroNivel === 'zerado'
                  ? 'bg-danger text-white shadow-soft font-bold'
                  : 'bg-surface-2 text-danger-text hover:bg-danger-soft/40 border border-danger/30'
              )}
            >
              Esgotados ({totalZerados})
            </button>
            <button
              onClick={() => setFiltroNivel('baixo')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 min-h-[36px]',
                filtroNivel === 'baixo'
                  ? 'bg-brand text-on-brand shadow-soft font-bold'
                  : 'bg-surface-2 text-brand-text hover:bg-brand-soft/40 border border-brand/30'
              )}
            >
              Estoque Baixo ({totalBaixos})
            </button>
          </div>

          {/* Switch / Toggle "Apenas produtos ativos" */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-text-2 min-h-[44px]">
            <input
              type="checkbox"
              checked={apenasAtivos}
              onChange={(e) => setApenasAtivos(e.target.checked)}
              className="w-4 h-4 rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
            />
            <span>Apenas produtos ativos</span>
          </label>
        </div>
      </div>

      {/* Tabela de Produtos em Alerta */}
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
            <h3 className="text-base font-bold text-text">Erro ao carregar alertas de estoque</h3>
            <p className="text-sm text-text-2 mt-1 max-w-md mx-auto">
              {(error as Error)?.message || 'Não foi possível comunicar com o serviço de gestão.'}
            </p>
            <Button variant="secondary" size="md" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : alertasFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-success/60 mx-auto mb-3" />
            <h3 className="text-base font-bold text-text">Nenhum produto em alerta</h3>
            <p className="text-sm text-text-2 mt-1">
              Todos os produtos atendem aos critérios de filtro selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs font-bold text-text-2 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4">Produto</th>
                  <th scope="col" className="py-3 px-4">Categoria</th>
                  <th scope="col" className="py-3 px-4 text-center">Estoque Atual</th>
                  <th scope="col" className="py-3 px-4 text-center">Estoque Mínimo</th>
                  <th scope="col" className="py-3 px-4 w-44">Nível Visual</th>
                  <th scope="col" className="py-3 px-4 text-center">Severidade</th>
                  <th scope="col" className="py-3 px-4 text-right">Último Movimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {alertasFiltrados.map((item: ItemAlertaEstoque) => {
                  const pctEstoque =
                    item.estoque_minimo > 0
                      ? (item.estoque_atual / item.estoque_minimo) * 100
                      : 0;

                  const isZerado = item.nivel === 'zerado' || item.estoque_atual <= 0;

                  return (
                    <tr
                      key={item.produto_id}
                      className={cn(
                        'transition-colors duration-100',
                        isZerado
                          ? 'bg-danger-soft/15 hover:bg-danger-soft/25'
                          : 'hover:bg-surface-2/40'
                      )}
                    >
                      {/* Nome do Produto */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text">{item.nome_produto}</div>
                        <div className="text-[11px] text-text-2">ID: #{item.produto_id}</div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-text-2 border border-border">
                          {item.categoria}
                        </span>
                      </td>

                      {/* Estoque Atual */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            'inline-block px-2.5 py-1 rounded-md font-black text-sm tabular-nums',
                            isZerado
                              ? 'bg-danger text-white'
                              : 'bg-brand-soft text-brand-text font-extrabold'
                          )}
                        >
                          {item.estoque_atual} un
                        </span>
                      </td>

                      {/* Estoque Mínimo */}
                      <td className="py-3.5 px-4 text-center text-text-2 font-semibold tabular-nums">
                        {item.estoque_minimo} un
                      </td>

                      {/* Barra de Progresso Visual de Nível */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border/50">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-200',
                                isZerado
                                  ? 'bg-danger w-0'
                                  : pctEstoque < 50
                                  ? 'bg-danger'
                                  : 'bg-brand'
                              )}
                              style={{ width: `${Math.min(pctEstoque, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-text-2 tabular-nums">
                            <span>{pctEstoque.toFixed(0)}% do mínimo</span>
                            <span>{item.estoque_atual}/{item.estoque_minimo}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status / Severidade Pill */}
                      <td className="py-3.5 px-4 text-center">
                        {isZerado ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-danger-soft text-danger border border-danger/40">
                            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                            Esgotado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand-text border border-brand/40">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Estoque Baixo
                          </span>
                        )}
                      </td>

                      {/* Último Movimento */}
                      <td className="py-3.5 px-4 text-right text-xs text-text-2 tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-text-2/70" />
                          {formatarData(item.ultimo_movimento_em)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé com totalizadores */}
        {!isLoading && !isError && alertasFiltrados.length > 0 && (
          <div className="p-4 bg-surface-2/60 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-2 gap-2">
            <span>
              Listando <strong>{alertasFiltrados.length}</strong> itens críticos em alerta
            </span>
            <div className="flex items-center gap-3">
              <span className="text-danger font-bold">
                ● {totalZerados} zerados
              </span>
              <span className="text-brand-text font-bold">
                ▲ {totalBaixos} abaixo do mínimo
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
