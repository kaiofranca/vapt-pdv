import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Search,
  Hourglass,
  Lock,
  Receipt,
  AlertCircle,
  Flame,
  CheckCircle2,
  Trash2,
  FileText,
} from 'lucide-react';
import { ProdutoStepperCard } from './ProdutoStepperCard';
import { BottomSheetObservacao } from './BottomSheetObservacao';
import { ModalCancelarComanda } from '../../../components/ui/ModalCancelarComanda';
import { ModalPendenciasKds, type ItemPendenciaModal } from './ModalPendenciasKds';
import { obterPendenciasComanda } from '../../../services/kds';
import { useComanda, useFecharComanda, useLancarItem, useCancelarComanda } from '../../../hooks/useComandas';
import { useProdutosDisponiveis } from '../../../hooks/useProdutos';
import { formatCurrency, formatElapsedTime } from '../../../lib/utils';
import { ApiError } from '../../../services/apiClient';
import type { Produto } from '../../../types/api';

export interface ComandaMesaViewProps {
  comandaId: number;
  garcomNome?: string;
  onVoltar: () => void;
  onToast: (tipo: 'sucesso' | 'erro', msg: string) => void;
}

interface ItemCarrinhoNovo {
  quantidade: number;
  observacao?: string;
}

export const ComandaMesaView: React.FC<ComandaMesaViewProps> = ({
  comandaId,
  garcomNome,
  onVoltar,
  onToast,
}) => {
  const { data: comanda, isLoading: isLoadingComanda, refetch: refetchComanda } = useComanda(comandaId);
  const { data: produtos = [], isLoading: isLoadingProdutos } = useProdutosDisponiveis();

  const fecharComandaMut = useFecharComanda();
  const lancarItemMut = useLancarItem();
  const cancelarComandaMut = useCancelarComanda();

  // Sub-abas quando a mesa está aberta: 'novos' (cardápio) vs 'enviados' (itens já no banco)
  const [subAba, setSubAba] = useState<'novos' | 'enviados'>('novos');

  // Modo de visualização de fechamento ('comanda' ou 'pedir_conta')
  const [modoFechamento, setModoFechamento] = useState<boolean>(false);

  // Switch de Gorjeta 10% no pedido da conta (G06)
  const [aplicarGorjeta, setAplicarGorjeta] = useState<boolean>(true);

  // Busca e categoria do cardápio
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todos');

  // Carrinho local de novos itens a lançar: Map<produtoId, ItemCarrinhoNovo>
  const [carrinhoNovos, setCarrinhoNovos] = useState<Map<number, ItemCarrinhoNovo>>(new Map());

  // Bottom Sheet G04 de Observação e Alergia
  const [produtoObservacao, setProdutoObservacao] = useState<Produto | null>(null);
  const [isObservacaoOpen, setIsObservacaoOpen] = useState(false);

  // Menu de opções rápidas (...)
  const [menuOpcoesAberto, setMenuOpcoesAberto] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [isModalPendenciasOpen, setIsModalPendenciasOpen] = useState(false);
  const [pendenciasKds, setPendenciasKds] = useState<ItemPendenciaModal[]>([]);
  const [isChecandoPendenciasKds, setIsChecandoPendenciasKds] = useState(false);
  const [isEnviandoItens, setIsEnviandoItens] = useState(false);

  // Extrai lista única de categorias
  const categorias = useMemo(() => {
    const setCat = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria) setCat.add(p.categoria);
    });
    return ['todos', ...Array.from(setCat)];
  }, [produtos]);

  // Produtos filtrados por busca e categoria
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchBusca =
        !busca ||
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busca.toLowerCase());
      const matchCat = categoriaAtiva === 'todos' || p.categoria === categoriaAtiva;
      return matchBusca && matchCat;
    });
  }, [produtos, busca, categoriaAtiva]);

  // Quantidade de um produto no carrinho de novos itens
  const getQtdNoCarrinho = (produtoId: number): number => {
    return carrinhoNovos.get(produtoId)?.quantidade || 0;
  };

  // Observação de um produto no carrinho de novos itens
  const getObsNoCarrinho = (produtoId: number): string | undefined => {
    return carrinhoNovos.get(produtoId)?.observacao;
  };

  const handleIncrementar = (produtoId: number) => {
    setCarrinhoNovos((prev) => {
      const mapa = new Map(prev);
      const atual = mapa.get(produtoId) || { quantidade: 0 };
      mapa.set(produtoId, {
        ...atual,
        quantidade: atual.quantidade + 1,
      });
      return mapa;
    });
  };

  const handleDecrementar = (produtoId: number) => {
    setCarrinhoNovos((prev) => {
      const mapa = new Map(prev);
      const atual = mapa.get(produtoId);
      if (!atual || atual.quantidade <= 1) {
        mapa.delete(produtoId);
      } else {
        mapa.set(produtoId, {
          ...atual,
          quantidade: atual.quantidade - 1,
        });
      }
      return mapa;
    });
  };

  const handleAbrirObservacao = (produto: Produto) => {
    setProdutoObservacao(produto);
    setIsObservacaoOpen(true);
  };

  const handleConfirmarObservacao = (obs: string) => {
    if (produtoObservacao) {
      const prodId = produtoObservacao.id;
      setCarrinhoNovos((prev) => {
        const mapa = new Map(prev);
        const atual = mapa.get(prodId) || { quantidade: 0 };
        const novaQtd = atual.quantidade > 0 ? atual.quantidade : 1;
        mapa.set(prodId, {
          quantidade: novaQtd,
          observacao: obs.trim() ? obs.trim() : undefined,
        });
        return mapa;
      });
    }
    setIsObservacaoOpen(false);
    setProdutoObservacao(null);
  };

  // Resumo do carrinho de novos itens
  const resumoNovos = useMemo(() => {
    let totalQtd = 0;
    let totalValor = 0;

    carrinhoNovos.forEach((item, prodId) => {
      const prod = produtos.find((p) => p.id === prodId);
      if (prod) {
        totalQtd += item.quantidade;
        totalValor += Number(prod.preco) * item.quantidade;
      }
    });

    return { totalQtd, totalValor };
  }, [carrinhoNovos, produtos]);

  // Enviar novos itens ao preparo (Fastify POST /comandas/:id/itens)
  const handleEnviarAoPreparo = async () => {
    if (carrinhoNovos.size === 0) return;
    setIsEnviandoItens(true);

    try {
      for (const [prodId, item] of carrinhoNovos.entries()) {
        await lancarItemMut.mutateAsync({
          comandaId,
          dto: {
            produto_id: prodId,
            quantidade: item.quantidade,
            observacao: item.observacao || null,
          },
        });
      }

      setCarrinhoNovos(new Map());
      await refetchComanda();
      setSubAba('enviados');
      onToast('sucesso', 'Itens enviados ao preparo com sucesso!');
    } catch (err) {
      if (err instanceof ApiError) {
        onToast('erro', err.message);
      } else {
        onToast('erro', 'Erro ao lançar itens.');
      }
    } finally {
      setIsEnviandoItens(false);
    }
  };

  const executarFechamento = async () => {
    try {
      await fecharComandaMut.mutateAsync({
        comandaId,
        dto: { aplicar_taxa_servico: aplicarGorjeta },
      });
      await refetchComanda();
      setModoFechamento(false);
      onToast('sucesso', 'Conta pedida! O caixa foi avisado.');
    } catch (err) {
      if (err instanceof ApiError) {
        onToast('erro', err.message);
      } else {
        onToast('erro', 'Erro ao pedir a conta.');
      }
    }
  };

  // Confirmar e avisar o caixa (Fastify POST /comandas/:id/fechar) com checagem KDS
  const handleConfirmarPedirConta = async () => {
    setIsChecandoPendenciasKds(true);
    try {
      const res = await obterPendenciasComanda(comandaId);
      if (res.possui_pendencias && res.pendencias.length > 0) {
        setPendenciasKds(
          res.pendencias.map((p) => ({
            id: p.id,
            nome_produto: p.nome_produto,
            quantidade: p.quantidade,
            setor: p.setor,
            status: p.status,
          }))
        );
        setIsModalPendenciasOpen(true);
        return;
      }
    } catch {
      // Degradação suave em caso de falha de rede/timeout
    } finally {
      setIsChecandoPendenciasKds(false);
    }
    await executarFechamento();
  };

  // Cancelar comanda (chamado somente após a dupla validação no modal)
  const handleCancelarComanda = async () => {
    try {
      await cancelarComandaMut.mutateAsync(comandaId);
      setModalCancelarAberto(false);
      onToast('sucesso', 'Comanda cancelada.');
      onVoltar();
    } catch (err) {
      if (err instanceof ApiError) {
        onToast('erro', err.message);
      } else {
        onToast('erro', 'Erro ao cancelar comanda.');
      }
    }
  };

  if (isLoadingComanda) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-text-2">Carregando detalhes da mesa...</p>
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className="py-12 text-center bg-surface border border-danger/30 rounded-[20px] p-6">
        <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
        <p className="text-sm font-bold text-text">Comanda não encontrada.</p>
        <button
          onClick={onVoltar}
          className="mt-4 px-4 py-2 rounded-full bg-surface-2 text-xs font-bold"
        >
          Voltar ao Salão
        </button>
      </div>
    );
  }

  const isContaPedida = comanda.status === 'fechada';
  const itensEnviados = comanda.itens || [];
  const tempoAberto = formatElapsedTime(comanda.aberta_em);

  // ─────────────────────────────────────────────────────────────────
  // CASO 1: CONTA JÁ PEDIDA / FECHADA (Fiel a G11 Conta aguardando.png)
  // ─────────────────────────────────────────────────────────────────
  if (isContaPedida) {
    return (
      <div className="space-y-4 pb-20">
        {/* Topo com Seta Voltar e Badge "Conta pedida" */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVoltar}
              className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-text tracking-tight">Mesa {comanda.mesa}</h2>
              <p className="text-xs text-text-2">
                {comanda.nome_cliente || 'Salão'} {garcomNome ? `· ${garcomNome}` : ''} · aberta há {tempoAberto}
              </p>
            </div>
          </div>

          <span className="bg-danger-soft text-danger text-xs font-bold px-3 py-1 rounded-full">
            Conta pedida
          </span>
        </div>

        {/* Card Destaque: Aguardando o Caixa (Fiel a G11) */}
        <div className="bg-surface border-2 border-danger rounded-[24px] p-6 text-center shadow-soft space-y-3">
          <div className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto">
            <Hourglass className="w-6 h-6 animate-pulse" />
          </div>

          <h3 className="text-xl font-black text-text">Aguardando o caixa</h3>
          <p className="text-xs text-text-2 max-w-xs mx-auto leading-relaxed">
            Pedido de conta enviado. A comanda está bloqueada para novos lançamentos.
          </p>

          <div className="pt-2">
            <div className="text-3xl font-black text-text">
              {formatCurrency(comanda.total || comanda.subtotal || '0.00')}
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              {comanda.taxa_servico && Number(comanda.taxa_servico) > 0
                ? 'com gorjeta de 10%'
                : 'sem taxa de serviço'}
            </div>
          </div>
        </div>

        {/* Lista de Itens Consumidos */}
        <div className="bg-surface border border-border rounded-[20px] p-4 space-y-3 shadow-soft">
          <div className="text-xs font-bold text-text-2">Itens consumidos</div>
          <div className="divide-y divide-border/60">
            {itensEnviados.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-text block">
                    {item.nome_copiado} · {item.quantidade}x
                  </span>
                  {item.observacao && (
                    <p className="text-[11px] text-brand-text italic flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-brand shrink-0" />
                      <span>{item.observacao}</span>
                    </p>
                  )}
                </div>
                <span className="font-extrabold text-text shrink-0">
                  {formatCurrency(Number(item.preco_copiado) * item.quantidade)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de Ajuste */}
        <div className="p-4 rounded-[16px] bg-brand-soft border border-brand/30 text-xs text-brand-text flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Errou algo? Solicite ao caixa no balcão para reabrir a comanda.</span>
        </div>

        {/* Botão Desabilitado com Cadeado (Fiel a G11) */}
        <div className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:mx-auto z-20">
          <button
            type="button"
            disabled
            className="w-full h-14 rounded-[18px] bg-surface-2 text-text-2/70 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-border shadow-soft"
          >
            <Lock className="w-4 h-4" />
            <span>Adicionar itens · conta pedida</span>
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CASO 2: TELA DE PEDIR A CONTA / TAXA 10% (Fiel a G06 Pedir a conta.png)
  // ─────────────────────────────────────────────────────────────────
  if (modoFechamento) {
    const subtotalNum = itensEnviados.reduce(
      (acc, i) => acc + Number(i.preco_copiado) * i.quantidade,
      0,
    );
    const gorjetaNum = aplicarGorjeta ? Math.round(subtotalNum * 10) / 100 : 0;
    const totalComGorjeta = subtotalNum + gorjetaNum;

    return (
      <div className="space-y-4 pb-28">
        {/* Topo com Seta Voltar à Comanda */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModoFechamento(false)}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-text tracking-tight">Pedir a conta</h2>
            <p className="text-xs text-text-2">
              Mesa {comanda.mesa} · {comanda.nome_cliente || 'Salão'}
            </p>
          </div>
        </div>

        {/* Card Resumo com Todos os Itens e Subtotal */}
        <div className="bg-surface border border-border rounded-[24px] p-5 shadow-soft space-y-4">
          <div className="divide-y divide-border/60">
            {itensEnviados.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-text block">
                    {item.nome_copiado} · {item.quantidade}x
                  </span>
                  {item.observacao && (
                    <p className="text-[11px] text-brand-text italic flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-brand shrink-0" />
                      <span>{item.observacao}</span>
                    </p>
                  )}
                </div>
                <span className="font-black text-text shrink-0">
                  {formatCurrency(Number(item.preco_copiado) * item.quantidade)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-text-2">
              <span>Subtotal</span>
              <span className="font-bold">{formatCurrency(subtotalNum)}</span>
            </div>
            {aplicarGorjeta && (
              <div className="flex items-center justify-between text-text-2">
                <span>Gorjeta 10%</span>
                <span className="font-bold">{formatCurrency(gorjetaNum)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-base font-black text-text pt-2 border-t border-border/50">
              <span>Total</span>
              <span className="text-xl">{formatCurrency(totalComGorjeta)}</span>
            </div>
          </div>
        </div>

        {/* Card com Switch Toggle da Gorjeta de 10% (Fiel a G06) */}
        <div className="bg-surface border border-border rounded-[20px] p-4 flex items-center justify-between shadow-soft">
          <div>
            <div className="font-extrabold text-sm text-text">Gorjeta de 10%</div>
            <div className="text-xs text-text-2 mt-0.5">Opcional, o cliente pode recusar</div>
          </div>

          <button
            type="button"
            onClick={() => setAplicarGorjeta(!aplicarGorjeta)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              aplicarGorjeta ? 'bg-success' : 'bg-surface-2 border border-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                aplicarGorjeta ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Alerta Informativo */}
        <div className="p-4 rounded-[16px] bg-brand-soft border border-brand/30 text-xs text-brand-text flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>O caixa será avisado. Você não conseguirá mais lançar itens depois de fechar.</span>
        </div>

        {/* Barra Fixa de Ação */}
        <div className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:mx-auto z-20 space-y-2">
          <button
            type="button"
            disabled={fecharComandaMut.isPending}
            onClick={handleConfirmarPedirConta}
            className="w-full h-14 rounded-[18px] bg-brand hover:bg-brand-hover text-on-brand font-black text-sm shadow-soft transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {fecharComandaMut.isPending ? 'Fechando conta...' : 'Confirmar e avisar o caixa'}
          </button>

          <button
            type="button"
            onClick={() => setModoFechamento(false)}
            className="w-full py-2 text-center text-xs font-bold text-text-2 hover:text-text"
          >
            Voltar à comanda
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CASO 3: COMANDA ABERTA (Fiel a G03 Comanda e G05 Itens enviados)
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28">
      {/* Topo com Seta Voltar, Título da Mesa e Menu de Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-text tracking-tight">Mesa {comanda.mesa}</h2>
            <p className="text-xs text-text-2">
              {comanda.nome_cliente || 'Salão'} {garcomNome ? `· ${garcomNome}` : ''} · aberta há {tempoAberto}
            </p>
          </div>
        </div>

        {/* Menu Três Pontos (...) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpcoesAberto(!menuOpcoesAberto)}
            className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text hover:bg-surface-2 active:scale-95 transition-all shadow-soft"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpcoesAberto && (
            <div className="absolute right-0 top-12 w-48 bg-surface border border-border rounded-[16px] shadow-modal py-1.5 z-40">
              <button
                type="button"
                onClick={() => {
                  setMenuOpcoesAberto(false);
                  setModoFechamento(true);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold text-text hover:bg-surface-2 flex items-center gap-2"
              >
                <Receipt className="w-4 h-4 text-brand" />
                <span>Pedir a conta</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpcoesAberto(false);
                  setModalCancelarAberto(true);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold text-danger hover:bg-danger-soft flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Cancelar comanda</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pill Switcher: "Novos" (Lançar do Cardápio) vs "Enviados" (Consumo já no banco) */}
      <div className="flex p-1 bg-surface-2 border border-border rounded-full select-none">
        <button
          type="button"
          onClick={() => setSubAba('novos')}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
            subAba === 'novos'
              ? 'bg-surface text-text shadow-soft'
              : 'text-text-2 hover:text-text'
          }`}
        >
          Cardápio / Novos {resumoNovos.totalQtd > 0 ? `(${resumoNovos.totalQtd})` : ''}
        </button>

        <button
          type="button"
          onClick={() => setSubAba('enviados')}
          className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
            subAba === 'enviados'
              ? 'bg-surface text-text shadow-soft'
              : 'text-text-2 hover:text-text'
          }`}
        >
          Enviados ({itensEnviados.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUB-ABA "ENVIADOS" (Fiel a G05 Itens enviados.png)
          ───────────────────────────────────────────────────────────── */}
      {subAba === 'enviados' && (
        <div className="space-y-3">
          {itensEnviados.length === 0 ? (
            <div className="py-12 text-center bg-surface border border-border rounded-[20px] p-6">
              <p className="text-sm font-bold text-text">Nenhum item lançado ainda.</p>
              <p className="text-xs text-text-2 mt-1 mb-4">
                Toque na aba "Cardápio / Novos" acima para selecionar produtos.
              </p>
              <button
                type="button"
                onClick={() => setSubAba('novos')}
                className="px-4 py-2 rounded-full bg-brand text-on-brand font-bold text-xs"
              >
                Ir para o cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {itensEnviados.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface border border-border rounded-[20px] p-4 flex items-center justify-between shadow-soft"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="font-extrabold text-sm text-text leading-snug">
                      {item.nome_copiado} · {item.quantidade}x
                    </h4>
                    {item.observacao ? (
                      <p className="text-xs text-brand-text italic flex items-center gap-1.5 mt-1 break-words">
                        <FileText className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span>{item.observacao}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-text-2 mt-0.5">Lançado na comanda</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="bg-success-soft text-success text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Gravado
                    </span>
                    <div className="text-sm font-black text-text">
                      {formatCurrency(Number(item.preco_copiado) * item.quantidade)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Botão de Fechar Pedindo a Conta na Base */}
              <div className="pt-4">
                <div className="flex items-center justify-between px-2 mb-3">
                  <span className="text-xs font-bold text-text-2">Total da comanda</span>
                  <span className="text-lg font-black text-text">
                    {formatCurrency(comanda.subtotal || comanda.total || '0.00')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setModoFechamento(true)}
                  className="w-full h-14 rounded-[18px] bg-brand hover:bg-brand-hover text-on-brand font-black text-sm shadow-soft flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Receipt className="w-5 h-5" />
                  <span>Pedir a conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUB-ABA "CARDÁPIO / NOVOS" (Fiel a G03 Comanda.png)
          ───────────────────────────────────────────────────────────── */}
      {subAba === 'novos' && (
        <div className="space-y-3">
          {/* Campo de Busca Rápida */}
          <div className="relative">
            <Search className="w-4 h-4 text-text-2 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar no cardápio"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-[16px] bg-surface border border-border text-text text-sm focus:outline-none focus:border-brand shadow-soft"
            />
          </div>

          {/* Chips Horizontais de Categorias (Fiel a G03) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all shrink-0 ${
                  categoriaAtiva === cat
                    ? 'bg-brand text-on-brand shadow-soft'
                    : 'bg-surface border border-border text-text hover:bg-surface-2'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de Produtos do Cardápio com Stepper Âmbar */}
          {isLoadingProdutos ? (
            <div className="py-8 text-center text-xs text-text-2">Carregando cardápio...</div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="py-10 text-center text-xs text-text-2">
              Nenhum produto encontrado nesta categoria.
            </div>
          ) : (
            <div className="space-y-2.5">
              {produtosFiltrados.map((prod) => (
                <ProdutoStepperCard
                  key={prod.id}
                  produto={prod}
                  quantidade={getQtdNoCarrinho(prod.id)}
                  observacao={getObsNoCarrinho(prod.id)}
                  onIncrementar={() => handleIncrementar(prod.id)}
                  onDecrementar={() => handleDecrementar(prod.id)}
                  onAbrirObservacao={() => handleAbrirObservacao(prod)}
                />
              ))}
            </div>
          )}

          {/* Barra Fixa Inferior: "X itens novos" / "R$ Total" / Botão "🔥 Enviar ao preparo" */}
          {resumoNovos.totalQtd > 0 && (
            <div className="fixed bottom-4 left-4 right-4 sm:max-w-md sm:mx-auto bg-surface border border-border rounded-[24px] p-3 shadow-modal z-30 space-y-2">
              <div className="flex items-center justify-between px-2 text-xs">
                <span className="font-bold text-text-2">
                  {resumoNovos.totalQtd} {resumoNovos.totalQtd === 1 ? 'item novo' : 'itens novos'}
                </span>
                <span className="font-black text-base text-text">
                  {formatCurrency(resumoNovos.totalValor)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isEnviandoItens}
                  onClick={handleEnviarAoPreparo}
                  className="flex-1 h-12 rounded-[16px] bg-brand hover:bg-brand-hover text-on-brand font-black text-xs shadow-soft flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Flame className="w-4 h-4 fill-on-brand" />
                  <span>
                    {isEnviandoItens ? 'Gravando no banco...' : 'Enviar ao preparo'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dupla validação para cancelar a comanda */}
      <ModalCancelarComanda
        isOpen={modalCancelarAberto}
        mesa={String(comanda.mesa)}
        isLoading={cancelarComandaMut.isPending}
        onClose={() => setModalCancelarAberto(false)}
        onConfirmar={handleCancelarComanda}
      />

      {/* Bottom Sheet G04 de Observação e Alergia */}
      <BottomSheetObservacao
        isOpen={isObservacaoOpen}
        produtoNome={produtoObservacao?.nome || ''}
        observacaoInicial={produtoObservacao ? getObsNoCarrinho(produtoObservacao.id) || '' : ''}
        onConfirmar={handleConfirmarObservacao}
        onClose={() => {
          setIsObservacaoOpen(false);
          setProdutoObservacao(null);
        }}
      />
    
      {/* Diálogo C04: Conflito de Encerramento (KDS :3001) */}
      <ModalPendenciasKds
        isOpen={isModalPendenciasOpen}
        mesa={comanda?.mesa}
        pendencias={pendenciasKds}
        isLoading={fecharComandaMut.isPending || isChecandoPendenciasKds}
        onAguardarEntrega={() => {
          setIsModalPendenciasOpen(false);
          setPendenciasKds([]);
          setModoFechamento(false);
        }}
        onFecharMesmoAssim={async () => {
          setIsModalPendenciasOpen(false);
          setPendenciasKds([]);
          await executarFechamento();
        }}
      />
    </div>
  );
};
