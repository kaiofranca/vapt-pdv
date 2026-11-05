import React, { useState, useMemo } from 'react';
import { Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { useRankingProdutos } from '../../../hooks/useGestao';
import { formatCurrency } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export const CurvaAbcView: React.FC = () => {
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

  const {
    data: rankingData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useRankingProdutos({ limite: 100 });

  // Lista única de categorias encontradas nos produtos
  const categoriasDisponiveis = useMemo(() => {
    if (!rankingData?.produtos) return [];
    const cats = new Set<string>();
    rankingData.produtos.forEach((p) => {
      if (p.categoria) cats.add(p.categoria);
    });
    return Array.from(cats);
  }, [rankingData]);

  // Produtos filtrados por categoria se selecionado
  const produtosFiltrados = useMemo(() => {
    if (!rankingData?.produtos) return [];
    if (categoriaFiltro === 'todas') return rankingData.produtos;
    return rankingData.produtos.filter((p) => p.categoria.toLowerCase() === categoriaFiltro.toLowerCase());
  }, [rankingData, categoriaFiltro]);

  // Agregações por Classe A, B e C
  const metricasClasses = useMemo(() => {
    const defaultStats = {
      A: { count: 0, receita: 0 },
      B: { count: 0, receita: 0 },
      C: { count: 0, receita: 0 },
      totalReceita: 0,
    };

    if (!rankingData?.produtos) return defaultStats;

    const total = parseFloat(rankingData.receita_total_acumulada || '0');
    defaultStats.totalReceita = total;

    rankingData.produtos.forEach((p) => {
      const rec = parseFloat(p.receita_gerada || '0');
      if (p.classe_abc === 'A') {
        defaultStats.A.count += 1;
        defaultStats.A.receita += rec;
      } else if (p.classe_abc === 'B') {
        defaultStats.B.count += 1;
        defaultStats.B.receita += rec;
      } else if (p.classe_abc === 'C') {
        defaultStats.C.count += 1;
        defaultStats.C.receita += rec;
      }
    });

    return defaultStats;
  }, [rankingData]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO & VISÃO GERAL DE PARETO
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text tracking-tight flex items-center gap-2">
            Curva ABC de Produtos
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M10
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-text-2 mt-0.5">
            Classificação de Pareto (80/15/5) para identificação dos itens mais rentáveis do cardápio.
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
          Atualizar Curva ABC
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CARDS DE RESUMO DAS CLASSES A, B E C
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Classe A (até 80% da receita) */}
        <div className="bg-surface border-2 border-success/40 rounded-[20px] p-5 shadow-soft relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-success">
              Classe A · Até 80%
            </span>
            <Badge variant="success" size="sm">
              Alto Impacto
            </Badge>
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {formatCurrency(metricasClasses.A.receita)}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {metricasClasses.A.count} produto(s) representam{' '}
            <strong className="text-text font-mono">
              {metricasClasses.totalReceita > 0
                ? Math.round((metricasClasses.A.receita / metricasClasses.totalReceita) * 100)
                : 0}
              %
            </strong>{' '}
            do faturamento total.
          </div>
        </div>

        {/* Card Classe B (80% a 95% da receita) */}
        <div className="bg-surface border-2 border-brand/50 rounded-[20px] p-5 shadow-soft relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-text">
              Classe B · 80% a 95%
            </span>
            <Badge variant="ocupada" size="sm">
              Médio Impacto
            </Badge>
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {formatCurrency(metricasClasses.B.receita)}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {metricasClasses.B.count} produto(s) representam{' '}
            <strong className="text-text font-mono">
              {metricasClasses.totalReceita > 0
                ? Math.round((metricasClasses.B.receita / metricasClasses.totalReceita) * 100)
                : 0}
              %
            </strong>{' '}
            do faturamento total.
          </div>
        </div>

        {/* Card Classe C (últimos 5% da receita) */}
        <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-text-2">
              Classe C · Últimos 5%
            </span>
            <Badge variant="neutral" size="sm">
              Cauda Longa
            </Badge>
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {formatCurrency(metricasClasses.C.receita)}
          </div>
          <div className="text-xs text-text-2 mt-1">
            {metricasClasses.C.count} produto(s) representam{' '}
            <strong className="text-text font-mono">
              {metricasClasses.totalReceita > 0
                ? Math.round((metricasClasses.C.receita / metricasClasses.totalReceita) * 100)
                : 0}
              %
            </strong>{' '}
            do faturamento total.
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTRO DE CATEGORIA POR CHIPS
          ───────────────────────────────────────────────────────────── */}
      {categoriasDisponiveis.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2">
          <span className="text-xs font-bold text-text-2 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setCategoriaFiltro('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              categoriaFiltro === 'todas'
                ? 'bg-brand text-on-brand shadow-soft'
                : 'bg-surface border border-border text-text hover:bg-surface-2'
            }`}
          >
            Todas ({rankingData?.produtos?.length ?? 0})
          </button>
          {categoriasDisponiveis.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                categoriaFiltro.toLowerCase() === cat.toLowerCase()
                  ? 'bg-brand text-on-brand shadow-soft'
                  : 'bg-surface border border-border text-text hover:bg-surface-2'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TABELA DETALHADA DA CURVA ABC
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text tracking-tight">
            Ranking Completo Ordenado por Receita
          </h3>
          <span className="text-xs font-mono font-bold text-text-2 tabular-nums">
            Receita total acumulada: {formatCurrency(rankingData?.receita_total_acumulada)}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-surface-2 rounded-[12px]" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center bg-danger-soft border border-danger/30 rounded-[16px]">
            <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
            <div className="text-sm font-bold text-danger-text">
              Erro ao carregar o ranking de produtos
            </div>
            <p className="text-xs text-danger-text/80 mt-1 mb-3">
              Verifique a conexão com o serviço gestao-service na porta :3003.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-2">
            Nenhum produto encontrado para os critérios selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-2 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Posição</th>
                  <th className="py-3 px-3">Produto</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3 text-right">Qtd. Vendida</th>
                  <th className="py-3 px-3 text-right">Receita Gerada</th>
                  <th className="py-3 px-3 text-right">% Receita</th>
                  <th className="py-3 px-3 text-right">% Acumulado</th>
                  <th className="py-3 px-3 text-center">Classe ABC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {produtosFiltrados.map((prod) => (
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
                    <td className="py-3 px-3 text-right font-mono font-semibold text-text-2 tabular-nums">
                      {prod.percentual_acumulado}%
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
