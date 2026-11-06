import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  Package,
} from 'lucide-react';
import { obterRankingProdutos } from '../../../services/gestao';
import type { ItemRankingProduto } from '../../../types/api';
import { formatCurrency, cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/Button';

export interface CurvaAbcViewProps {
  onAbrirExportacao?: () => void;
}

const CATEGORIAS_OPCOES = [
  'Todas',
  'Lanches',
  'Porções',
  'Bebidas',
  'Sobremesas',
  'Combos',
];

export const CurvaAbcView: React.FC<CurvaAbcViewProps> = ({ onAbrirExportacao }) => {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('Todas');
  const [limiteSelecionado, setLimiteSelecionado] = useState<number | undefined>(undefined);
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'gestao',
      'ranking-produtos',
      {
        categoria: categoriaSelecionada === 'Todas' ? undefined : categoriaSelecionada,
        limite: limiteSelecionado,
      },
    ],
    queryFn: () =>
      obterRankingProdutos({
        categoria: categoriaSelecionada === 'Todas' ? undefined : categoriaSelecionada,
        limite: limiteSelecionado,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const produtos = data?.produtos ?? [];
  const receitaTotal = parseFloat(data?.receita_total_acumulada || '0');

  // Cálculos consolidados para os 3 cards do topo
  const resumoClasses = useMemo(() => {
    let qtdA = 0;
    let recA = 0;
    let qtdB = 0;
    let recB = 0;
    let qtdC = 0;
    let recC = 0;

    produtos.forEach((p) => {
      const valor = parseFloat(p.receita_gerada || '0');
      if (p.classe_abc === 'A') {
        qtdA += 1;
        recA += valor;
      } else if (p.classe_abc === 'B') {
        qtdB += 1;
        recB += valor;
      } else {
        qtdC += 1;
        recC += valor;
      }
    });

    const pctA = receitaTotal > 0 ? (recA / receitaTotal) * 100 : 0;
    const pctB = receitaTotal > 0 ? (recB / receitaTotal) * 100 : 0;
    const pctC = receitaTotal > 0 ? (recC / receitaTotal) * 100 : 0;

    return {
      A: { quantidade: qtdA, receita: recA, percentual: pctA },
      B: { quantidade: qtdB, receita: recB, percentual: pctB },
      C: { quantidade: qtdC, receita: recC, percentual: pctC },
    };
  }, [produtos, receitaTotal]);

  // Filtro de texto em memória pelo nome do produto
  const produtosFiltrados = useMemo(() => {
    if (!buscaTexto.trim()) return produtos;
    const termo = buscaTexto.toLowerCase();
    return produtos.filter(
      (p) =>
        p.nome_produto.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
    );
  }, [produtos, buscaTexto]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Visão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-brand-text">
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-black text-text tracking-tight">
              Curva ABC de Produtos
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M10
            </span>
          </div>
          <p className="text-sm text-text-2 mt-1">
            Classificação analítica de Pareto (80/15/5) para identificar o impacto financeiro de cada item no faturamento.
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

      {/* 3 Cards de Resumo no Topo (Classe A, Classe B, Classe C) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Classe A - Mostarda / Brand */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-brand/40 shadow-soft p-5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-brand" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-brand-soft text-brand-text font-black text-sm flex items-center justify-center border border-brand/30">
                A
              </span>
              <span className="text-xs font-bold text-text-2 uppercase tracking-wider">
                Classe A · Alto Impacto
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-soft text-brand-text">
              Até 80% da receita
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-text tabular-nums">
              {formatCurrency(resumoClasses.A.receita)}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-text-2">
              <span>{resumoClasses.A.quantidade} produtos ({produtos.length > 0 ? ((resumoClasses.A.quantidade / produtos.length) * 100).toFixed(0) : 0}% do catálogo)</span>
              <span className="font-bold text-brand-text tabular-nums">
                {resumoClasses.A.percentual.toFixed(1)}% do total
              </span>
            </div>
            {/* Barra proporcional visual */}
            <div className="w-full bg-surface-2 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-brand h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(resumoClasses.A.percentual, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card Classe B - Manjericão / Success */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-success/40 shadow-soft p-5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-success" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-success-soft text-success-text font-black text-sm flex items-center justify-center border border-success/30">
                B
              </span>
              <span className="text-xs font-bold text-text-2 uppercase tracking-wider">
                Classe B · Médio Giro
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-soft text-success-text">
              80% a 95% da receita
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-text tabular-nums">
              {formatCurrency(resumoClasses.B.receita)}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-text-2">
              <span>{resumoClasses.B.quantidade} produtos ({produtos.length > 0 ? ((resumoClasses.B.quantidade / produtos.length) * 100).toFixed(0) : 0}% do catálogo)</span>
              <span className="font-bold text-success-text tabular-nums">
                {resumoClasses.B.percentual.toFixed(1)}% do total
              </span>
            </div>
            {/* Barra proporcional visual */}
            <div className="w-full bg-surface-2 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-success h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(resumoClasses.B.percentual, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card Classe C - Tomate / Danger */}
        <div className="relative overflow-hidden rounded-card bg-surface border border-danger/40 shadow-soft p-5">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-danger" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-danger-soft text-danger-text font-black text-sm flex items-center justify-center border border-danger/30">
                C
              </span>
              <span className="text-xs font-bold text-text-2 uppercase tracking-wider">
                Classe C · Cauda Longa
              </span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-danger-soft text-danger-text">
              Últimos 5% da receita
            </span>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-black text-text tabular-nums">
              {formatCurrency(resumoClasses.C.receita)}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-text-2">
              <span>{resumoClasses.C.quantidade} produtos ({produtos.length > 0 ? ((resumoClasses.C.quantidade / produtos.length) * 100).toFixed(0) : 0}% do catálogo)</span>
              <span className="font-bold text-danger-text tabular-nums">
                {resumoClasses.C.percentual.toFixed(1)}% do total
              </span>
            </div>
            {/* Barra proporcional visual */}
            <div className="w-full bg-surface-2 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-danger h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(resumoClasses.C.percentual, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-card bg-surface border border-border p-4 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Busca por texto */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-text-2 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder="Filtrar por nome do produto ou categoria..."
              className="w-full h-11 pl-10 pr-4 rounded-input bg-surface-2 border border-border text-text placeholder:text-text-2/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          {/* Filtro de Categoria (Chips com rolagem ou select) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs font-semibold text-text-2 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Categoria:
            </span>
            {CATEGORIAS_OPCOES.map((cat) => {
              const ativo = categoriaSelecionada === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaSelecionada(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 min-h-[36px]',
                    ativo
                      ? 'bg-brand text-on-brand shadow-soft font-bold'
                      : 'bg-surface-2 text-text-2 hover:text-text hover:bg-border/50 border border-border/60'
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Seletor de Limite */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-text-2">Exibir:</span>
            <select
              value={limiteSelecionado ?? ''}
              onChange={(e) =>
                setLimiteSelecionado(e.target.value ? Number(e.target.value) : undefined)
              }
              aria-label="Limite de produtos a exibir"
              className="h-9 px-3 rounded-input bg-surface-2 border border-border text-text text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Todos os itens</option>
              <option value="15">Top 15</option>
              <option value="30">Top 30</option>
              <option value="50">Top 50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela Detalhada de Produtos */}
      <div className="rounded-card bg-surface border border-border shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-6 bg-surface-2 rounded-md animate-pulse w-48" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-2/60 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
            <h3 className="text-base font-bold text-text">Erro ao carregar Curva ABC</h3>
            <p className="text-sm text-text-2 mt-1 max-w-md mx-auto">
              {(error as Error)?.message || 'Não foi possível comunicar com o serviço de gestão.'}
            </p>
            <Button variant="secondary" size="md" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-text-2/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-text">Nenhum produto encontrado</h3>
            <p className="text-sm text-text-2 mt-1">
              Não há dados de vendas para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs font-bold text-text-2 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4 w-14 text-center">#</th>
                  <th scope="col" className="py-3 px-4">Produto</th>
                  <th scope="col" className="py-3 px-4">Categoria</th>
                  <th scope="col" className="py-3 px-4 text-right">Qtd. Vendida</th>
                  <th scope="col" className="py-3 px-4 text-right">Receita Total</th>
                  <th scope="col" className="py-3 px-4 text-right">% Receita</th>
                  <th scope="col" className="py-3 px-4 w-44">Acumulado</th>
                  <th scope="col" className="py-3 px-4 text-center w-24">Classe ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {produtosFiltrados.map((item: ItemRankingProduto) => {
                  const pctAcumulado = parseFloat(item.percentual_acumulado || '0');
                  const pctReceita = parseFloat(item.percentual_receita || '0');

                  return (
                    <tr
                      key={item.produto_id}
                      className="hover:bg-surface-2/40 transition-colors duration-100"
                    >
                      {/* Posição / Ranking */}
                      <td className="py-3.5 px-4 text-center">
                        {item.posicao <= 3 ? (
                          <span
                            className={cn(
                              'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-soft',
                              item.posicao === 1 && 'bg-brand text-on-brand',
                              item.posicao === 2 && 'bg-surface-2 text-text border border-border-strong',
                              item.posicao === 3 && 'bg-amber-700/20 text-amber-900 dark:text-amber-300 border border-amber-600/30'
                            )}
                          >
                            {item.posicao}º
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-text-2 tabular-nums">
                            {item.posicao}º
                          </span>
                        )}
                      </td>

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

                      {/* Quantidade Vendida */}
                      <td className="py-3.5 px-4 text-right font-semibold text-text tabular-nums">
                        {item.quantidade_vendida.toLocaleString('pt-BR')} un
                      </td>

                      {/* Receita Gerada */}
                      <td className="py-3.5 px-4 text-right font-black text-text tabular-nums">
                        {formatCurrency(item.receita_gerada)}
                      </td>

                      {/* Percentual da Receita */}
                      <td className="py-3.5 px-4 text-right text-text-2 tabular-nums font-semibold">
                        {pctReceita.toFixed(1)}%
                      </td>

                      {/* Percentual Acumulado com barra de progresso */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-200',
                                item.classe_abc === 'A' && 'bg-brand',
                                item.classe_abc === 'B' && 'bg-success',
                                item.classe_abc === 'C' && 'bg-danger'
                              )}
                              style={{ width: `${Math.min(pctAcumulado, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-text tabular-nums min-w-[42px] text-right">
                            {pctAcumulado.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Classe ABC Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-black leading-none tracking-wide select-none',
                            item.classe_abc === 'A' && 'bg-brand-soft text-brand-text border border-brand/40',
                            item.classe_abc === 'B' && 'bg-success-soft text-success-text border border-success/40',
                            item.classe_abc === 'C' && 'bg-danger-soft text-danger-text border border-danger/40'
                          )}
                        >
                          Classe {item.classe_abc}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da tabela com contagem e receita consolidada */}
        {!isLoading && !isError && produtosFiltrados.length > 0 && (
          <div className="p-4 bg-surface-2/60 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-2 gap-2">
            <span>
              Exibindo <strong>{produtosFiltrados.length}</strong> de <strong>{produtos.length}</strong> produtos analisados
            </span>
            <span className="font-semibold">
              Faturamento Total Acumulado: <strong className="text-text tabular-nums">{formatCurrency(receitaTotal)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
