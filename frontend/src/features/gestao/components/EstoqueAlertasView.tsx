import React, { useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  PackagePlus,
  X,
} from 'lucide-react';
import { useAlertasEstoque } from '../../../hooks/useGestao';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  ReporEstoqueModal,
  type ProdutoParaReposicao,
} from './ReporEstoqueModal';

export const EstoqueAlertasView: React.FC = () => {
  const [filtroNivel, setFiltroNivel] = useState<'todos' | 'zerado' | 'baixo'>('todos');
  const [produtoParaRepor, setProdutoParaRepor] = useState<ProdutoParaReposicao | null>(null);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  const {
    data: alertasData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useAlertasEstoque({ apenas_ativos: true });

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 4000);
  };

  const formatarData = (iso?: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const alertasFiltrados = useMemo(() => {
    if (!alertasData?.alertas) return [];
    if (filtroNivel === 'todos') return alertasData.alertas;
    return alertasData.alertas.filter((a) => a.nivel === filtroNivel);
  }, [alertasData, filtroNivel]);

  const contagemZerados = useMemo(() => {
    return alertasData?.alertas?.filter((a) => a.nivel === 'zerado').length ?? 0;
  }, [alertasData]);

  const contagemBaixo = useMemo(() => {
    return alertasData?.alertas?.filter((a) => a.nivel === 'baixo').length ?? 0;
  }, [alertasData]);

  const handleRepostoComSucesso = (_produtoAtualizado: unknown, quantidade: number) => {
    exibirToast(`Reposição de ${quantidade} unidades confirmada com sucesso!`);
    refetch();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Toast flutuante */}
      {toastMensagem && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-success text-white shadow-soft font-semibold text-sm animate-slideDown"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMensagem}</span>
          <button
            onClick={() => setToastMensagem(null)}
            className="ml-2 hover:opacity-80 p-0.5"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO & ATUALIZAÇÃO
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-text tracking-tight flex items-center gap-2">
            Controle de Estoque e Alertas
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-text-2 border border-border">
              M05
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-text-2 mt-0.5">
            Monitoramento de itens abaixo da margem de segurança ou com estoque esgotado.
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
          Atualizar Estoque
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BANNER DE ALERTA SE HOUVER ITENS CRÍTICOS
          ───────────────────────────────────────────────────────────── */}
      {contagemZerados > 0 && (
        <div className="p-4 rounded-[18px] bg-danger-soft border-2 border-danger/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-danger text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-danger-text">
                Atenção: {contagemZerados} produto(s) com estoque zerado
              </h3>
              <p className="text-xs text-danger-text/80 mt-0.5">
                Itens com estoque esgotado não podem ser vendidos no salão. Providencie a reposição imediata.
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setFiltroNivel('zerado')}
            className="shrink-0 text-xs"
          >
            Ver zerados
          </Button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CARDS DE RESUMO (KPIs)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total em Alerta */}
        <div
          onClick={() => setFiltroNivel('todos')}
          className={`p-4 rounded-[18px] border cursor-pointer transition-all ${
            filtroNivel === 'todos'
              ? 'border-brand bg-surface shadow-soft ring-2 ring-brand/20'
              : 'border-border bg-surface hover:border-brand/40'
          }`}
        >
          <div className="flex items-center justify-between text-text-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Crítico
            </span>
            <Package className="w-4 h-4 text-brand" />
          </div>
          <div className="text-2xl font-black text-text tabular-nums font-mono">
            {alertasData?.alertas?.length ?? 0}
          </div>
          <div className="text-xs text-text-2 mt-1">Produtos exigindo atenção</div>
        </div>

        {/* Card 2: Estoque Zerado */}
        <div
          onClick={() => setFiltroNivel('zerado')}
          className={`p-4 rounded-[18px] border cursor-pointer transition-all ${
            filtroNivel === 'zerado'
              ? 'border-danger bg-danger-soft/40 shadow-soft ring-2 ring-danger/20'
              : 'border-border bg-surface hover:border-danger/40'
          }`}
        >
          <div className="flex items-center justify-between text-danger mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Estoque Zerado
            </span>
            <Badge variant="danger" size="sm">
              Ruptura
            </Badge>
          </div>
          <div className="text-2xl font-black text-danger tabular-nums font-mono">
            {contagemZerados}
          </div>
          <div className="text-xs text-text-2 mt-1">Vendas travadas no salão</div>
        </div>

        {/* Card 3: Estoque Baixo */}
        <div
          onClick={() => setFiltroNivel('baixo')}
          className={`p-4 rounded-[18px] border cursor-pointer transition-all ${
            filtroNivel === 'baixo'
              ? 'border-brand bg-brand-soft/40 shadow-soft ring-2 ring-brand/20'
              : 'border-border bg-surface hover:border-brand/40'
          }`}
        >
          <div className="flex items-center justify-between text-brand-text mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Estoque Baixo
            </span>
            <Badge variant="ocupada" size="sm">
              Abaixo do Mínimo
            </Badge>
          </div>
          <div className="text-2xl font-black text-brand-text tabular-nums font-mono">
            {contagemBaixo}
          </div>
          <div className="text-xs text-text-2 mt-1">Próximo da margem crítica</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FILTRO DE NÍVEL
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-text-2">Exibir:</span>
        <button
          type="button"
          onClick={() => setFiltroNivel('todos')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroNivel === 'todos'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          Todos em Alerta ({alertasData?.alertas?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setFiltroNivel('zerado')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroNivel === 'zerado'
              ? 'bg-danger text-white shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          Zerados ({contagemZerados})
        </button>
        <button
          type="button"
          onClick={() => setFiltroNivel('baixo')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            filtroNivel === 'baixo'
              ? 'bg-brand text-on-brand shadow-soft'
              : 'bg-surface border border-border text-text hover:bg-surface-2'
          }`}
        >
          Baixo ({contagemBaixo})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TABELA DE PRODUTOS COM ESTOQUE CRÍTICO
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-[20px] p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text tracking-tight">
            Produtos em Estado de Alerta
          </h3>
          <span className="text-xs text-text-2 font-medium">
            {alertasFiltrados.length} item(ns) listado(s)
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
              Erro ao consultar alertas de estoque
            </div>
            <p className="text-xs text-danger-text/80 mt-1 mb-3">
              Não foi possível comunicar com o endpoint /gestao/alertas-estoque.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : alertasFiltrados.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-2 flex flex-col items-center">
            <CheckCircle2 className="w-8 h-8 text-success mb-2" />
            <span className="font-bold text-sm text-text">Estoque Regularizado</span>
            <span className="mt-0.5">
              Nenhum item com estoque abaixo da margem mínima no momento.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-2 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Produto</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3 text-right">Estoque Atual</th>
                  <th className="py-3 px-3 text-right">Estoque Mínimo</th>
                  <th className="py-3 px-3 text-center">Nível</th>
                  <th className="py-3 px-3 text-center min-w-[140px]">Nível Visual</th>
                  <th className="py-3 px-3 text-right">Último Movimento</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {alertasFiltrados.map((alerta) => {
                  const pct =
                    alerta.estoque_minimo > 0
                      ? Math.min(
                          Math.round((alerta.estoque_atual / alerta.estoque_minimo) * 100),
                          100,
                        )
                      : 0;

                  return (
                    <tr key={alerta.produto_id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-text">
                        {alerta.nome_produto}
                      </td>
                      <td className="py-3 px-3 text-text-2">
                        {alerta.categoria}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-text tabular-nums">
                        {alerta.estoque_atual}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-text-2 tabular-nums">
                        {alerta.estoque_minimo}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={alerta.nivel === 'zerado' ? 'danger' : 'ocupada'}
                          size="sm"
                        >
                          {alerta.nivel === 'zerado' ? 'Zerado' : 'Baixo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                          <div
                            style={{ width: `${Math.max(pct, alerta.estoque_atual > 0 ? 5 : 0)}%` }}
                            className={`h-full transition-all rounded-full ${
                              alerta.nivel === 'zerado'
                                ? 'bg-danger'
                                : 'bg-brand'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] text-text-2 font-mono tabular-nums block mt-0.5">
                          {pct}% do mínimo
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-text-2 tabular-nums">
                        {formatarData(alerta.ultimo_movimento_em)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setProdutoParaRepor({
                              id: alerta.produto_id,
                              nome: alerta.nome_produto,
                              categoria: alerta.categoria,
                              estoque: alerta.estoque_atual,
                              estoque_minimo: alerta.estoque_minimo,
                            })
                          }
                          leftIcon={<PackagePlus className="w-3.5 h-3.5" />}
                          className="h-8 px-2.5 text-xs shadow-soft shrink-0"
                          aria-label={`Repor estoque de ${alerta.nome_produto}`}
                        >
                          Repor
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Reposição de Estoque (M06) */}
      <ReporEstoqueModal
        isOpen={Boolean(produtoParaRepor)}
        onClose={() => setProdutoParaRepor(null)}
        produto={produtoParaRepor}
        onRepostoComSucesso={handleRepostoComSucesso}
      />
    </div>
  );
};
