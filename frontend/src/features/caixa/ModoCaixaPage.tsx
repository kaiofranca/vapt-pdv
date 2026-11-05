import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  LogOut,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { SidebarNav, type AbaNavegacaoCaixa } from './components/SidebarNav';
import { CatalogoGrid } from './components/CatalogoGrid';
import { PainelComanda } from './components/PainelComanda';
import { MesasCaixaView } from './components/MesasCaixaView';
import { PedidosCaixaView } from './components/PedidosCaixaView';
import { ReceberCaixaView } from './components/ReceberCaixaView';
import { ModalPagamento } from './components/ModalPagamento';
import { ComprovanteVenda } from './components/ComprovanteVenda';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { ModalCancelarComanda } from './components/ModalCancelarComanda';
import { LogoMark } from '../../components/ui/Logo';
import { formatCurrency } from '../../lib/utils';
import { useSessionStore } from '../../stores/useSessionStore';
import { useComandaStore } from '../../stores/useComandaStore';
import {
  useComandas,
  useComandasSalao,
  useLancarItem,
  useAbrirComanda,
  useFecharComanda,
  useCancelarComanda,
} from '../../hooks/useComandas';
import { useProdutosDisponiveis } from '../../hooks/useProdutos';
import { useGarconsAtivos } from '../../hooks/useUsuarios';
import type { Comanda, Produto } from '../../types/api';
import { ApiError } from '../../services/apiClient';

export const ModoCaixaPage: React.FC = () => {
  const { nomeOperador, perfilAtivo, logout } = useSessionStore();
  const { comandaAtivaId, setComandaAtivaId } = useComandaStore();

  // Queries TanStack Query com dados reais do PostgreSQL
  const { data: todasComandas = [], refetch: refetchTodas } = useComandas();
  const { data: comandasSalao = [], refetch: refetchSalao } = useComandasSalao();
  const { data: produtos = [], isLoading: isLoadingProdutos } = useProdutosDisponiveis();
  const { data: garcons = [] } = useGarconsAtivos();

  // Mutações
  const lancarItemMut = useLancarItem();
  const abrirComandaMut = useAbrirComanda();
  const fecharComandaMut = useFecharComanda();
  const cancelarComandaMut = useCancelarComanda();

  // Navegação lateral interna (venda, mesas, pedidos, receber)
  const [abaNavegacao, setAbaNavegacao] = useState<AbaNavegacaoCaixa>('venda');

  // Termo de busca e ref do input para atalho F2
  const [buscaValor, setBuscaValor] = useState<string>('');
  const buscaInputRef = useRef<HTMLInputElement>(null);

  // Switch de taxa 10%
  const [taxa10, setTaxa10] = useState<boolean>(true);

  // Dados do cliente vinculado
  const [nomeCliente, setNomeCliente] = useState<string>('');
  const [documentoCliente, setDocumentoCliente] = useState<string>('');

  // Modais de Operação
  const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState<boolean>(false);
  const [comandaParaPagamento, setComandaParaPagamento] = useState<Comanda | null>(null);

  const [isModalReciboOpen, setIsModalReciboOpen] = useState<boolean>(false);
  const [comandaParaRecibo, setComandaParaRecibo] = useState<Comanda | null>(null);

  // Fechar conta (pela tela de Mesas) e cancelar comanda (dupla validação)
  const [comandaParaFechar, setComandaParaFechar] = useState<Comanda | null>(null);
  const [taxaFechamento, setTaxaFechamento] = useState<boolean>(true);
  const [comandaParaCancelar, setComandaParaCancelar] = useState<Comanda | null>(null);

  const [isModalClienteOpen, setIsModalClienteOpen] = useState<boolean>(false);
  const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState<boolean>(false);
  const [novaMesaInput, setNovaMesaInput] = useState<string>('');
  const [novoGarcomId, setNovoGarcomId] = useState<number | null>(null);

  // Toasts de feedback
  const [toast, setToast] = useState<{
    tipo: 'sucesso' | 'erro';
    mensagem: string;
  } | null>(null);

  const showToast = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setToast({ tipo, mensagem });
    setTimeout(() => setToast(null), 4000);
  };

  // Contagem de contas pedidas aguardando quitação no caixa
  const contasPedidasCount = useMemo(() => {
    return comandasSalao.filter((c) => c.status === 'fechada').length;
  }, [comandasSalao]);

  // Garante que uma comanda esteja selecionada se houver mesas em atendimento
  useEffect(() => {
    if (comandasSalao.length > 0) {
      if (!comandaAtivaId || !comandasSalao.some((c) => c.id === comandaAtivaId)) {
        setComandaAtivaId(comandasSalao[0].id);
      }
    } else {
      setComandaAtivaId(null);
    }
  }, [comandasSalao, comandaAtivaId, setComandaAtivaId]);

  // Garante seleção padrão de garçom para abertura de mesa
  useEffect(() => {
    if (garcons.length > 0 && !novoGarcomId) {
      setNovoGarcomId(garcons[0].id);
    }
  }, [garcons, novoGarcomId]);

  // Comanda ativa selecionada no painel de venda
  const comandaAtiva = comandasSalao.find((c) => c.id === comandaAtivaId) || null;

  // Lançamento rápido de produto no caixa
  const handleLancarItemCatalogo = async (produto: Produto) => {
    if (!comandaAtivaId || !comandaAtiva) {
      showToast('erro', 'Nenhuma comanda aberta. Abra uma mesa antes de lançar itens.');
      setIsModalAbrirMesaOpen(true);
      return;
    }

    if (comandaAtiva.status === 'fechada') {
      showToast(
        'erro',
        `A Mesa ${comandaAtiva.mesa} está com a conta fechada. Não é possível lançar novos itens.`
      );
      return;
    }

    try {
      await lancarItemMut.mutateAsync({
        comandaId: comandaAtivaId,
        dto: {
          produto_id: produto.id,
          quantidade: 1,
        },
      });
      showToast('sucesso', `${produto.nome} lançado na Mesa ${comandaAtiva.mesa}.`);
    } catch (err) {
      showToast(
        'erro',
        err instanceof ApiError ? err.message : 'Erro ao lançar item na comanda.'
      );
    }
  };

  // Abertura do modal de pagamento para qualquer comanda
  const handleAbrirPagamento = (comanda: Comanda) => {
    setComandaParaPagamento(comanda);
    setIsModalPagamentoOpen(true);
  };

  // Conclusão do pagamento
  const handlePagamentoConcluido = (_comandaPaga: Comanda) => {
    refetchSalao();
    refetchTodas();
  };

  // Visualizar recibo / comprovante
  const handleVerRecibo = (comanda: Comanda) => {
    setComandaParaRecibo(comanda);
    setIsModalReciboOpen(true);
  };

  // Ao clicar em 'Nova Venda' ou fechar após quitação, limpa dados do cliente anterior
  const handleNovaVenda = () => {
    setNomeCliente('');
    setDocumentoCliente('');
    setIsModalPagamentoOpen(false);
    setComandaParaPagamento(null);
  };

  // Criação de nova comanda pelo caixa
  const handleConfirmarAbrirMesa = async () => {
    if (!novaMesaInput.trim()) {
      showToast('erro', 'Informe o número da mesa.');
      return;
    }
    const garcomId = novoGarcomId || (garcons[0] ? garcons[0].id : 1);

    try {
      const nova = await abrirComandaMut.mutateAsync({
        mesa: novaMesaInput.trim(),
        garcom_id: garcomId,
        nome_cliente: nomeCliente.trim() || undefined,
      });
      showToast('sucesso', `Mesa ${nova.mesa} aberta com sucesso!`);
      setComandaAtivaId(nova.id);
      setIsModalAbrirMesaOpen(false);
      setNovaMesaInput('');
      setAbaNavegacao('venda');
      refetchSalao();
      refetchTodas();
    } catch (err) {
      showToast(
        'erro',
        err instanceof ApiError ? `${err.codigo}: ${err.message}` : 'Erro ao abrir mesa.'
      );
    }
  };

  // Abre a confirmação de fechamento (permite escolher a gorjeta de 10%)
  const handleFecharConta = (comanda: Comanda) => {
    if (!comanda.itens || comanda.itens.length === 0) {
      showToast('erro', `A Mesa ${comanda.mesa} não tem itens lançados. Lance itens ou cancele a comanda.`);
      return;
    }
    setTaxaFechamento(taxa10);
    setComandaParaFechar(comanda);
  };

  const handleConfirmarFecharConta = async () => {
    if (!comandaParaFechar) return;
    const comanda = comandaParaFechar;
    try {
      await fecharComandaMut.mutateAsync({
        comandaId: comanda.id,
        dto: { aplicar_taxa_servico: taxaFechamento },
      });
      showToast(
        'sucesso',
        `Conta da Mesa ${comanda.mesa} fechada${taxaFechamento ? ' (gorjeta de 10% aplicada)' : ''}.`
      );
      setComandaParaFechar(null);
      refetchSalao();
      refetchTodas();
    } catch (err) {
      showToast(
        'erro',
        err instanceof ApiError ? err.message : 'Erro ao fechar conta da comanda.'
      );
    }
  };

  const handleConfirmarCancelamento = async (motivo?: string) => {
    if (!comandaParaCancelar) return;
    const comanda = comandaParaCancelar;
    try {
      await cancelarComandaMut.mutateAsync(comanda.id);
      const motivoAviso = motivo ? ` (Motivo: ${motivo})` : '';
      showToast('sucesso', `Comanda da Mesa ${comanda.mesa} cancelada${motivoAviso}. Mesa liberada.`);
      if (comandaAtivaId === comanda.id) {
        setComandaAtivaId(null);
      }
      refetchSalao();
      refetchTodas();
    } catch (err) {
      showToast(
        'erro',
        err instanceof ApiError ? err.message : 'Erro ao cancelar comanda.'
      );
    } finally {
      setComandaParaCancelar(null);
    }
  };

  // Atalhos Globais de Teclado Protegidos (F2, F4, F8, Esc)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape: Fechar Modais Secundários
      if (event.key === 'Escape') {
        if (isModalClienteOpen) {
          setIsModalClienteOpen(false);
          return;
        } else if (isModalAbrirMesaOpen) {
          setIsModalAbrirMesaOpen(false);
          return;
        } else if (isModalReciboOpen) {
          setIsModalReciboOpen(false);
          return;
        }
      }

      // Ignora atalhos de digitação se o foco estiver em INPUT ou TEXTAREA
      const target = event.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isInput) {
        return;
      }

      // Não dispara atalhos de venda/cobrança se o modal de pagamento já estiver aberto
      if (isModalPagamentoOpen || isModalReciboOpen) {
        return;
      }

      // F2: Focar Busca (se estiver na aba de venda)
      if (event.key === 'F2') {
        event.preventDefault();
        setAbaNavegacao('venda');
        setTimeout(() => {
          buscaInputRef.current?.focus();
          buscaInputRef.current?.select();
        }, 50);
        return;
      }

      // F4: Cliente / CPF
      if (event.key === 'F4') {
        event.preventDefault();
        setIsModalClienteOpen(true);
        return;
      }

      // F8: Cobrar
      if (event.key === 'F8') {
        event.preventDefault();
        if (comandaAtiva && comandaAtiva.itens && comandaAtiva.itens.length > 0) {
          if (comandaAtiva.status === 'fechada') {
            handleAbrirPagamento(comandaAtiva);
          } else {
            fecharComandaMut.mutate(
              {
                comandaId: comandaAtiva.id,
                dto: { aplicar_taxa_servico: taxa10 },
              },
              {
                onSuccess: (comandaFechada) => {
                  showToast('sucesso', `Mesa ${comandaAtiva.mesa} fechada.`);
                  handleAbrirPagamento(comandaFechada);
                },
                onError: (err) => {
                  showToast(
                    'erro',
                    err instanceof ApiError ? err.message : 'Erro ao fechar comanda.'
                  );
                },
              }
            );
          }
        } else {
          showToast('erro', 'A comanda está sem itens ou nenhuma mesa está selecionada.');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    comandaAtiva,
    taxa10,
    fecharComandaMut,
    isModalClienteOpen,
    isModalAbrirMesaOpen,
    isModalPagamentoOpen,
    isModalReciboOpen,
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-row bg-bg text-text select-none">
      {/* Toast Flutuante no Topo */}
      {toast && (
        <div className="fixed top-4 right-6 z-[60] animate-bounce">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-card shadow-modal border text-xs font-bold ${
              toast.tipo === 'sucesso'
                ? 'bg-success text-white border-success'
                : 'bg-danger text-white border-danger'
            }`}
          >
            {toast.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.mensagem}</span>
          </div>
        </div>
      )}

      {/* 1. Barra Lateral Compacta de 88px */}
      <SidebarNav
        abaAtiva={abaNavegacao}
        onAbaChange={(aba) => setAbaNavegacao(aba)}
        contasPedidasCount={contasPedidasCount}
      />

      {/* 2. Conteúdo Central + TopBar + Telas Integradas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TopBar Superior de 80px (DESIGN.md §6.1) */}
        <header className="h-20 min-h-[80px] max-h-[80px] bg-surface border-b border-border px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <LogoMark size={40} className="shrink-0" />
            <h1 className="text-xl font-black text-text tracking-tight">Balcão &amp; Caixa</h1>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setNovaMesaInput('');
                setIsModalAbrirMesaOpen(true);
              }}
              className="text-xs ml-2 font-bold"
            >
              Abrir Mesa
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle variante="icon" />

            {/* Operador Ativo */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border shadow-soft text-xs font-semibold">
              <User className="w-4 h-4 text-brand-text" />
              <span>{nomeOperador}</span>
              {perfilAtivo && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-soft text-brand-text">
                  {perfilAtivo}
                </span>
              )}
            </div>

            {/* Botão de Logout */}
            <button
              onClick={logout}
              title="Trocar Operador / Ir para Login"
              className="p-2 text-danger hover:bg-danger-soft rounded-full transition-colors border border-danger/30"
              aria-label="Trocar Operador"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Área Central Renderizada Dinamicamente de acordo com a Aba Ativa */}
        {abaNavegacao === 'venda' && (
          <div className="flex-1 flex flex-row overflow-hidden animate-fadeIn">
            {/* Catálogo de Produtos em 4 Colunas (C01 Venda.png) */}
            <CatalogoGrid
              produtos={produtos}
              isLoading={isLoadingProdutos}
              onLancarItem={handleLancarItemCatalogo}
              buscaInputRef={buscaInputRef}
              buscaValor={buscaValor}
              onBuscaChange={setBuscaValor}
              comandaAbertaId={comandaAtivaId}
            />

            {/* Painel Lateral Fixo de 440px Antissobreposição */}
            <PainelComanda
              comandaAtivaId={comandaAtivaId}
              comandasDisponiveis={comandasSalao}
              onSelecionarComanda={(id) => setComandaAtivaId(id)}
              onAbrirModalPagamento={handleAbrirPagamento}
              onAbrirModalCliente={() => setIsModalClienteOpen(true)}
              onCancelarComanda={(cmd) => setComandaParaCancelar(cmd)}
              nomeCliente={nomeCliente}
              documentoCliente={documentoCliente}
              onToast={showToast}
              taxa10={taxa10}
              onTaxa10Change={setTaxa10}
            />
          </div>
        )}

        {abaNavegacao === 'mesas' && (
          <MesasCaixaView
            comandas={comandasSalao}
            garcons={garcons}
            onSelecionarMesa={(cmd) => {
              setComandaAtivaId(cmd.id);
              setAbaNavegacao('venda');
            }}
            onAbrirMesa={(mesaNum) => {
              if (mesaNum) setNovaMesaInput(mesaNum);
              setIsModalAbrirMesaOpen(true);
            }}
            onFecharConta={handleFecharConta}
            onCancelarComanda={(cmd) => setComandaParaCancelar(cmd)}
            onReceberPagamento={handleAbrirPagamento}
          />
        )}

        {abaNavegacao === 'pedidos' && (
          <PedidosCaixaView
            comandas={todasComandas}
            garcons={garcons}
            onSelecionarComanda={(cmd) => {
              setComandaAtivaId(cmd.id);
              setAbaNavegacao('venda');
            }}
            onReceberPagamento={handleAbrirPagamento}
            onVerComprovante={handleVerRecibo}
          />
        )}

        {abaNavegacao === 'receber' && (
          <ReceberCaixaView
            comandas={todasComandas}
            garcons={garcons}
            onReceberPagamento={handleAbrirPagamento}
            onVerComprovante={handleVerRecibo}
          />
        )}

        {/* Rodapé de Atalhos de Teclado (DESIGN.md §6.1 / §8.5) */}
        <footer className="h-10 min-h-[40px] max-h-[40px] bg-surface-2 border-t border-border px-6 flex items-center justify-between text-xs text-text-2 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[11px] font-bold text-text">
                F2
              </kbd>
              Buscar Produto
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[11px] font-bold text-text">
                F4
              </kbd>
              Cliente / CPF
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[11px] font-bold text-text">
                F8
              </kbd>
              Cobrar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface px-1.5 py-0.5 rounded border border-border font-mono text-[11px] font-bold text-text">
                Esc
              </kbd>
              Fechar Janela
            </span>
          </div>
        </footer>
      </div>

      {/* Modal de Pagamento em 3 Colunas com Split e Quitação Exata */}
      <ModalPagamento
        isOpen={isModalPagamentoOpen}
        onClose={handleNovaVenda}
        onNovaVenda={handleNovaVenda}
        comanda={comandaParaPagamento}
        onPagamentoConcluido={handlePagamentoConcluido}
        nomeOperador={nomeOperador}
        documentoClienteInicial={documentoCliente}
        onToast={showToast}
      />

      {/* Confirmação de fechamento de conta (permite definir a gorjeta de 10%) */}
      <Modal
        isOpen={!!comandaParaFechar}
        onClose={() => setComandaParaFechar(null)}
        title={comandaParaFechar ? `Fechar conta da Mesa ${comandaParaFechar.mesa}` : 'Fechar conta'}
        maxWidth="sm"
      >
        {comandaParaFechar && (() => {
          const subtotal = (comandaParaFechar.itens || []).reduce(
            (acc, it) => acc + parseFloat(it.preco_copiado || '0') * it.quantidade,
            0
          );
          const taxa = taxaFechamento ? Math.round(subtotal * 10) / 100 : 0;
          return (
            <div className="space-y-4 py-1">
              <div className="p-3.5 rounded-card bg-surface-2/60 border border-border space-y-1.5 text-sm">
                <div className="flex justify-between text-text-2">
                  <span>Subtotal ({comandaParaFechar.itens?.length || 0} itens)</span>
                  <span className="font-semibold text-text tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span>Gorjeta 10%</span>
                  <span className="font-semibold text-text tabular-nums">{formatCurrency(taxa)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border">
                  <span className="font-bold text-text">Total</span>
                  <span className="text-xl font-black text-text tabular-nums">{formatCurrency(subtotal + taxa)}</span>
                </div>
              </div>

              <ToggleSwitch
                checked={taxaFechamento}
                onChange={setTaxaFechamento}
                label="Aplicar gorjeta de 10% (garçom)"
                description="Calculada pelo servidor ao fechar a conta"
                className="w-full"
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setComandaParaFechar(null)}
                  disabled={fecharComandaMut.isPending}
                >
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmarFecharConta}
                  isLoading={fecharComandaMut.isPending}
                >
                  Fechar conta
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Dupla validação para cancelar a comanda */}
      <ModalCancelarComanda
        isOpen={!!comandaParaCancelar}
        mesa={comandaParaCancelar?.mesa}
        isLoading={cancelarComandaMut.isPending}
        onClose={() => setComandaParaCancelar(null)}
        onConfirmar={handleConfirmarCancelamento}
      />

      {/* Modal de Exibição / Reimpressão de Recibo Térmico */}
      {isModalReciboOpen && comandaParaRecibo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2019]/60 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-card-lg bg-surface border border-border shadow-modal p-6 text-left flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <h2 className="text-lg font-black text-text">Comprovante de Venda</h2>
              <button
                onClick={() => setIsModalReciboOpen(false)}
                className="p-1.5 rounded-btn text-text-2 hover:bg-surface-2"
                aria-label="Fechar comprovante"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-4">
              <ComprovanteVenda
                comanda={comandaParaRecibo}
                parcelas={[
                  {
                    id: '1',
                    forma: comandaParaRecibo.forma_pagamento || 'dinheiro',
                    valorCentavos: Math.round(
                      parseFloat(comandaParaRecibo.total || comandaParaRecibo.subtotal || '0') * 100
                    ),
                  },
                ]}
                nomeOperador={nomeOperador}
                documentoCliente={comandaParaRecibo.nome_cliente || undefined}
                onNovaVenda={() => setIsModalReciboOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido de Identificação do Cliente / CPF (F4) */}
      <Modal
        isOpen={isModalClienteOpen}
        onClose={() => setIsModalClienteOpen(false)}
        title="Identificação do Cliente / CPF (F4)"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <Input
            label="Nome do Cliente"
            placeholder="Ex: Carlos Oliveira"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
          />
          <Input
            label="CPF / CNPJ na Nota"
            placeholder="000.000.000-00"
            value={documentoCliente}
            onChange={(e) => setDocumentoCliente(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsModalClienteOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsModalClienteOpen(false);
                showToast('sucesso', 'Dados do cliente vinculados à venda.');
              }}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Rápido de Abertura de Mesa */}
      <Modal
        isOpen={isModalAbrirMesaOpen}
        onClose={() => setIsModalAbrirMesaOpen(false)}
        title="Abrir Nova Mesa no Salão"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <Input
            label="Número da Mesa"
            placeholder="Ex: 05"
            value={novaMesaInput}
            onChange={(e) => setNovaMesaInput(e.target.value)}
            autoFocus
          />

          <div>
            <label className="text-xs font-semibold text-text-2 block mb-1">
              Garçom Responsável
            </label>
            <select
              value={novoGarcomId || ''}
              onChange={(e) => setNovoGarcomId(Number(e.target.value))}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-input bg-surface border border-border text-text text-sm font-medium focus:outline-none focus:border-text shadow-soft"
            >
              {garcons.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} ({g.perfil})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Nome do Cliente (Opcional)"
            placeholder="Ex: Marina Souza"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setIsModalAbrirMesaOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarAbrirMesa}
              isLoading={abrirComandaMut.isPending}
            >
              Abrir e Atender
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
