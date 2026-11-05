import React, { useState, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Pencil,
  PowerOff,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  Utensils,
  Coffee,
  Cake,
  Package,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useProdutos } from '../../../hooks/useProdutos';
import { formatCurrency } from '../../../lib/utils';
import { ProdutoModal } from './ProdutoModal';
import { InativarProdutoDialog } from './InativarProdutoDialog';
import type {
  Produto,
  FiltroCategoriaCardapio,
  FiltroStatusCardapio,
} from '../types';

export const CardapioView: React.FC = () => {
  // Consulta de produtos do PDV Core (:3000)
  const { data: produtos = [], isLoading, isError, error, refetch } = useProdutos();

  // Estados de Filtros e Busca
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoriaCardapio>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusCardapio>('todos');

  // Estados dos Modais
  const [isModalProdutoAberto, setIsModalProdutoAberto] = useState(false);
  const [produtoParaEditar, setProdutoParaEditar] = useState<Produto | null>(null);
  const [produtoParaInativar, setProdutoParaInativar] = useState<Produto | null>(null);

  // Estado de Toast / Notificação
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 4000);
  };

  // Contadores analíticos rápidos
  const contadores = useMemo(() => {
    const total = produtos.length;
    const ativos = produtos.filter((p) => p.ativo).length;
    const inativos = total - ativos;
    const comidas = produtos.filter((p) => p.categoria === 'comida').length;
    const bebidas = produtos.filter((p) => p.categoria === 'bebida').length;
    const sobremesas = produtos.filter((p) => p.categoria === 'sobremesa').length;
    const outros = produtos.filter((p) => p.categoria === 'outros').length;
    const estoqueCritico = produtos.filter(
      (p) => p.ativo && p.estoque <= (p.estoque_minimo ?? 0)
    ).length;

    return { total, ativos, inativos, comidas, bebidas, sobremesas, outros, estoqueCritico };
  }, [produtos]);

  // Filtragem dos produtos em memória
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      // 1. Busca por nome ou ID
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const bateNome = p.nome.toLowerCase().includes(termo);
        const bateId = String(p.id).includes(termo);
        if (!bateNome && !bateId) return false;
      }

      // 2. Filtro de Categoria
      if (filtroCategoria !== 'todas' && p.categoria !== filtroCategoria) {
        return false;
      }

      // 3. Filtro de Status
      if (filtroStatus === 'ativo' && !p.ativo) return false;
      if (filtroStatus === 'inativo' && p.ativo) return false;

      return true;
    });
  }, [produtos, busca, filtroCategoria, filtroStatus]);

  // Ícone e estilização por categoria
  const getCategoriaInfo = (cat: string) => {
    switch (cat) {
      case 'comida':
        return {
          label: 'Comida',
          icone: Utensils,
          badgeClasse: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
        };
      case 'bebida':
        return {
          label: 'Bebida',
          icone: Coffee,
          badgeClasse: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300',
        };
      case 'sobremesa':
        return {
          label: 'Sobremesa',
          icone: Cake,
          badgeClasse: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300',
        };
      default:
        return {
          label: 'Outros',
          icone: Package,
          badgeClasse: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-300',
        };
    }
  };

  const handleAbrirCriacao = () => {
    setProdutoParaEditar(null);
    setIsModalProdutoAberto(true);
  };

  const handleAbrirEdicao = (p: Produto) => {
    setProdutoParaEditar(p);
    setIsModalProdutoAberto(true);
  };

  const handleAbrirInativacao = (p: Produto) => {
    setProdutoParaInativar(p);
  };

  const handleSalvoComSucesso = (p: Produto, modo: 'criado' | 'atualizado') => {
    exibirToast(
      modo === 'criado'
        ? `Produto "${p.nome}" cadastrado com sucesso!`
        : `Produto "${p.nome}" atualizado com sucesso!`
    );
  };

  const handleInativadoComSucesso = (p: Produto) => {
    exibirToast(`Produto "${p.nome}" inativado com sucesso (RN14).`);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {/* Toast flutuante de sucesso */}
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

      {/* Topo: Título da Tela e Botão Novo Produto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/10 text-brand-coffee dark:text-amber-300">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-text tracking-tight">
                Cardápio &amp; Produtos (M02)
              </h1>
              <p className="text-sm text-text-2">
                Gestão de itens do cardápio, precificação e níveis de estoque
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={handleAbrirCriacao}
          leftIcon={<Plus className="w-5 h-5" />}
          className="shadow-soft"
        >
          Novo Produto (M03)
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-2 uppercase tracking-wide">
            Total Produtos
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.total}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            Ativos no Salão
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.ativos}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
            Comidas
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.comidas}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
            Bebidas
          </span>
          <span className="text-2xl font-black text-text mt-1">
            {contadores.bebidas}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface border border-border shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Estoque Crítico
          </span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {contadores.estoqueCritico}
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-card bg-surface border border-border shadow-sm flex flex-col gap-4">
        {/* Campo de Busca Textual */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome do produto ou ID..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-border bg-surface-2 text-text text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-2 hover:text-text rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-lg border border-border self-start sm:self-auto">
            <span className="text-xs font-semibold text-text-2 px-2 hidden sm:inline">
              Status:
            </span>
            {(['todos', 'ativo', 'inativo'] as FiltroStatusCardapio[]).map((statusOpt) => (
              <button
                key={statusOpt}
                type="button"
                onClick={() => setFiltroStatus(statusOpt)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all capitalize min-h-[32px] ${
                  filtroStatus === statusOpt
                    ? 'bg-surface text-brand shadow-sm border border-brand/20'
                    : 'text-text-2 hover:text-text'
                }`}
              >
                {statusOpt === 'todos' ? 'Todos' : statusOpt === 'ativo' ? 'Ativos' : 'Inativos'}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Categorias (Chips) */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60">
          <span className="text-xs font-semibold text-text-2 flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Categoria:
          </span>
          {(
            [
              { id: 'todas', label: 'Todas as Categorias' },
              { id: 'comida', label: 'Comidas' },
              { id: 'bebida', label: 'Bebidas' },
              { id: 'sobremesa', label: 'Sobremesas' },
              { id: 'outros', label: 'Outros' },
            ] as { id: FiltroCategoriaCardapio; label: string }[]
          ).map((catOpt) => {
            const isAtivo = filtroCategoria === catOpt.id;
            return (
              <button
                key={catOpt.id}
                type="button"
                onClick={() => setFiltroCategoria(catOpt.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border min-h-[36px] flex items-center gap-1.5 ${
                  isAtivo
                    ? 'bg-brand text-on-brand border-brand shadow-sm'
                    : 'bg-surface-2 text-text-2 border-border hover:bg-surface hover:text-text'
                }`}
              >
                {catOpt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Principal: Tabela de Produtos */}
      <div className="rounded-card bg-surface border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-text-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand" />
            <p className="text-sm font-semibold">Carregando produtos do cardápio...</p>
          </div>
        ) : isError ? (
          <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-3 rounded-full bg-danger/10 text-danger">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-text text-lg">Erro ao carregar cardápio</h3>
              <p className="text-sm text-text-2 mt-1 max-w-md">
                {error instanceof Error ? error.message : 'Falha na comunicação com o servidor do PDV Core.'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Recarregar Cardápio
            </Button>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
            <UtensilsCrossed className="w-10 h-10 text-text-2/40" />
            <h3 className="font-bold text-text text-base">Nenhum produto encontrado</h3>
            <p className="text-sm text-text-2 max-w-sm">
              Não encontramos itens com os filtros e termos de busca selecionados.
            </p>
            {(busca || filtroCategoria !== 'todas' || filtroStatus !== 'todos') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setFiltroCategoria('todas');
                  setFiltroStatus('todos');
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-text-2 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4 text-right">Preço</th>
                  <th className="py-3.5 px-4 text-center">Estoque</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {produtosFiltrados.map((prod) => {
                  const catInfo = getCategoriaInfo(prod.categoria);
                  const CatIcon = catInfo.icone;
                  const isEstoqueBaixo = prod.estoque <= (prod.estoque_minimo ?? 0);
                  const isEsgotado = prod.estoque === 0;

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-surface-2/60 transition-colors ${
                        !prod.ativo ? 'opacity-65 bg-surface-2/20' : ''
                      }`}
                    >
                      {/* Produto: Nome e ID */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-text text-sm">
                            {prod.nome}
                          </span>
                          <span className="text-xs text-text-2 font-mono">
                            ID #{prod.id}
                          </span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${catInfo.badgeClasse}`}
                        >
                          <CatIcon className="w-3.5 h-3.5" />
                          {catInfo.label}
                        </span>
                      </td>

                      {/* Preço formatado */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono tabular-nums font-black text-text text-sm">
                          {formatCurrency(prod.preco)}
                        </span>
                      </td>

                      {/* Saldo de Estoque e Alerta */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          {isEsgotado ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-danger/10 text-danger border border-danger/30">
                              Esgotado
                            </span>
                          ) : isEstoqueBaixo ? (
                            <span className="text-rose-600 font-bold dark:text-rose-400 font-mono tabular-nums flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {prod.estoque} un
                            </span>
                          ) : (
                            <span className="font-mono tabular-nums font-semibold text-text">
                              {prod.estoque} un
                            </span>
                          )}
                          <span className="text-[10px] text-text-2 mt-0.5">
                            mín: {prod.estoque_minimo ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Status Ativo/Inativo */}
                      <td className="py-3 px-4 text-center">
                        {prod.ativo ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400">
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações: Editar e Inativar (sem DELETE físico - RN14) */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleAbrirEdicao(prod)}
                            title="Editar produto"
                            aria-label={`Editar produto ${prod.nome}`}
                            className="p-2 rounded-lg text-text-2 hover:text-text hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {prod.ativo ? (
                            <button
                              type="button"
                              onClick={() => handleAbrirInativacao(prod)}
                              title="Inativar produto (RN14)"
                              aria-label={`Inativar produto ${prod.nome}`}
                              className="p-2 rounded-lg text-danger/80 hover:text-danger hover:bg-danger/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <PowerOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="w-10 text-center text-xs text-text-2/40">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição de Produto */}
      <ProdutoModal
        isOpen={isModalProdutoAberto}
        onClose={() => setIsModalProdutoAberto(false)}
        produtoParaEditar={produtoParaEditar}
        onSalvoComSucesso={handleSalvoComSucesso}
      />

      {/* Diálogo de Confirmação de Inativação Lógica (RN14) */}
      <InativarProdutoDialog
        isOpen={Boolean(produtoParaInativar)}
        onClose={() => setProdutoParaInativar(null)}
        produtoParaInativar={produtoParaInativar}
        onInativadoComSucesso={handleInativadoComSucesso}
      />
    </div>
  );
};
