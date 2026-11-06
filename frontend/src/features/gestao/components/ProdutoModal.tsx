import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Coffee,
  Cake,
  Package,
  AlertCircle,
  Plus,
  Pencil,
  Boxes,
  DollarSign,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCriarProduto, useAtualizarProduto } from '../../../hooks/useProdutos';
import type { Produto, CategoriaProduto, CriarProdutoDto } from '../types';

export interface ProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  produtoParaEditar?: Produto | null;
  onSalvoComSucesso?: (produto: Produto, modo: 'criado' | 'atualizado') => void;
}

interface CategoriaOpcao {
  id: CategoriaProduto;
  titulo: string;
  descricao: string;
  icone: React.ElementType;
}

const CATEGORIAS_DISPONIVEIS: CategoriaOpcao[] = [
  {
    id: 'comida',
    titulo: 'Comida',
    descricao: 'Pratos, refeições e porções do salão',
    icone: Utensils,
  },
  {
    id: 'bebida',
    titulo: 'Bebida',
    descricao: 'Sucos, refrigerantes, águas e cervejas',
    icone: Coffee,
  },
  {
    id: 'sobremesa',
    titulo: 'Sobremesa',
    descricao: 'Doces, tortas, sobremesas e cafés',
    icone: Cake,
  },
  {
    id: 'outros',
    titulo: 'Outros',
    descricao: 'Embalagens e itens diversos',
    icone: Package,
  },
];

export const ProdutoModal: React.FC<ProdutoModalProps> = ({
  isOpen,
  onClose,
  produtoParaEditar,
  onSalvoComSucesso,
}) => {
  const isEdicao = Boolean(produtoParaEditar);
  const criarProdutoMut = useCriarProduto();
  const atualizarProdutoMut = useAtualizarProduto();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaProduto>('comida');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState('5');

  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroPreco, setErroPreco] = useState<string | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);

  // Sincroniza formulário ao abrir modal
  useEffect(() => {
    if (isOpen) {
      if (produtoParaEditar) {
        setNome(produtoParaEditar.nome);
        setCategoria(
          CATEGORIAS_DISPONIVEIS.some((c) => c.id === produtoParaEditar.categoria)
            ? (produtoParaEditar.categoria as CategoriaProduto)
            : 'comida'
        );
        // Formata preço para o input com 2 casas
        setPreco(produtoParaEditar.preco.replace('.', ','));
        setEstoque(String(produtoParaEditar.estoque ?? 0));
        setEstoqueMinimo(String(produtoParaEditar.estoque_minimo ?? 0));
      } else {
        setNome('');
        setCategoria('comida');
        setPreco('');
        setEstoque('0');
        setEstoqueMinimo('5');
      }
      setErroNome(null);
      setErroPreco(null);
      setErroApi(null);
    }
  }, [isOpen, produtoParaEditar]);

  // Converte string de preço (ex: "14,90" ou "14.90") em número e valida
  const validarPreco = (valorTexto: string): { valido: boolean; numero: number; formatado: string } => {
    const textoLimpo = valorTexto.trim().replace(',', '.');
    const num = parseFloat(textoLimpo);

    if (!valorTexto.trim() || isNaN(num) || num <= 0) {
      return { valido: false, numero: 0, formatado: '' };
    }

    return { valido: true, numero: num, formatado: num.toFixed(2) };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroApi(null);

    // Validações
    let temErro = false;
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErroNome('O nome do produto é obrigatório.');
      temErro = true;
    } else {
      setErroNome(null);
    }

    const checagemPreco = validarPreco(preco);
    if (!checagemPreco.valido) {
      setErroPreco('Preço deve ser maior que R$ 0,00.');
      temErro = true;
    } else {
      setErroPreco(null);
    }

    if (temErro) return;

    const numEstoque = Math.max(0, parseInt(estoque || '0', 10) || 0);
    const numEstoqueMinimo = Math.max(0, parseInt(estoqueMinimo || '0', 10) || 0);

    try {
      if (isEdicao && produtoParaEditar) {
        const dtoAtualizacao = {
          nome: nomeLimpo,
          categoria,
          preco: checagemPreco.formatado,
          estoque: numEstoque,
          estoque_minimo: numEstoqueMinimo,
        };

        const produtoAtualizado = await atualizarProdutoMut.mutateAsync({
          id: produtoParaEditar.id,
          dto: dtoAtualizacao,
        });

        onSalvoComSucesso?.(produtoAtualizado, 'atualizado');
      } else {
        const dtoCriacao: CriarProdutoDto = {
          nome: nomeLimpo,
          categoria,
          preco: checagemPreco.formatado,
          estoque: numEstoque,
          estoque_minimo: numEstoqueMinimo,
        };

        const novoProduto = await criarProdutoMut.mutateAsync(dtoCriacao);
        onSalvoComSucesso?.(novoProduto, 'criado');
      }

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErroApi(err.message);
      } else {
        setErroApi('Falha ao processar operação com o produto. Tente novamente.');
      }
    }
  };

  const isSalvando = criarProdutoMut.isPending || atualizarProdutoMut.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdicao ? 'Editar Produto (M03)' : 'Novo Produto (M03)'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-2">
        {erroApi && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{erroApi}</span>
          </div>
        )}

        {/* 1. Nome do Produto */}
        <div>
          <Input
            label="Nome do Produto *"
            placeholder="Ex.: Filé com Fritas ao Molho Madeira"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (erroNome && e.target.value.trim()) setErroNome(null);
            }}
            error={erroNome ?? undefined}
            autoFocus
            disabled={isSalvando}
            maxLength={100}
          />
        </div>

        {/* 2. Seleção de Categoria */}
        <div>
          <label className="text-sm font-semibold text-text block mb-2">
            Categoria *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CATEGORIAS_DISPONIVEIS.map((cat) => {
              const Icon = cat.icone;
              const isSelecionada = categoria === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoria(cat.id)}
                  disabled={isSalvando}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 min-h-[44px] ${
                    isSelecionada
                      ? 'border-brand bg-brand/10 text-brand-coffee dark:text-amber-300 ring-2 ring-brand/30'
                      : 'border-border bg-surface hover:bg-surface-2 text-text'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="font-bold text-sm">{cat.titulo}</span>
                  </div>
                  <span className="text-[11px] text-text-2 leading-tight">
                    {cat.descricao}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Preço e Estoque */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-semibold text-text block mb-1">
              Preço Unitário (R$) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-2">
                <DollarSign className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="0,00"
                value={preco}
                onChange={(e) => {
                  setPreco(e.target.value);
                  if (erroPreco) setErroPreco(null);
                }}
                disabled={isSalvando}
                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-text bg-surface text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                  erroPreco
                    ? 'border-danger focus:border-danger'
                    : 'border-border focus:border-brand'
                }`}
              />
            </div>
            {erroPreco && (
              <span className="text-xs text-danger mt-1 block">
                {erroPreco}
              </span>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-text block mb-1">
              {isEdicao ? 'Estoque Atual' : 'Estoque Inicial *'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-2">
                <Boxes className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={estoque}
                onChange={(e) => setEstoque(e.target.value)}
                disabled={isSalvando}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border text-text bg-surface text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            <span className="text-[11px] text-text-2 mt-1 block">
              Saldo físico disponível
            </span>
          </div>

          <div>
            <label className="text-sm font-semibold text-text block mb-1">
              Estoque Mínimo (Alerta)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-2">
                <Boxes className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="5"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                disabled={isSalvando}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border text-text bg-surface text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            <span className="text-[11px] text-text-2 mt-1 block">
              Gera alerta visual no cardápio
            </span>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSalvando}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSalvando}
            leftIcon={isEdicao ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          >
            {isEdicao ? 'Salvar Alterações' : 'Cadastrar Produto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
