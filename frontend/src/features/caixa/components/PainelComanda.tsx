import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Minus,
  Trash2,
  User,
  Clock,
  Receipt,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Ban,
} from 'lucide-react';
import type { Comanda, ItemComanda } from '../../../types/api';
import { formatCurrency, formatElapsedTime } from '../../../lib/utils';
import { Badge } from '../../../components/ui/Badge';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import {
  useComanda,
  useAjustarItem,
  useRemoverItem,
  useFecharComanda,
} from '../../../hooks/useComandas';
import { ApiError } from '../../../services/apiClient';
import { obterPendenciasComanda } from '../../../services/kds';
import { ModalPendenciasKds, type ItemPendenciaModal } from './ModalPendenciasKds';

export interface PainelComandaProps {
  comandaAtivaId: number | null;
  comandasDisponiveis: Comanda[];
  onSelecionarComanda: (comandaId: number) => void;
  onAbrirModalPagamento: (comanda: Comanda) => void;
  onAbrirModalCliente: () => void;
  onCancelarComanda: (comanda: Comanda) => void;
  nomeCliente?: string;
  documentoCliente?: string;
  onToast: (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => void;
  taxa10: boolean;
  onTaxa10Change: (aplicar: boolean) => void;
}

export const PainelComanda: React.FC<PainelComandaProps> = ({
  comandaAtivaId,
  comandasDisponiveis,
  onSelecionarComanda,
  onAbrirModalPagamento,
  onAbrirModalCliente,
  onCancelarComanda,
  nomeCliente,
  documentoCliente,
  onToast,
  taxa10,
  onTaxa10Change,
}) => {
  const { data: comandaAtualizada } = useComanda(comandaAtivaId);
  const ajustarItemMut = useAjustarItem();
  const removerItemMut = useRemoverItem();
  const fecharComandaMut = useFecharComanda();

  const [itemMutatingId, setItemMutatingId] = useState<number | null>(null);
  // Painel recolhível: libera espaço para o catálogo quando o operador não precisa da comanda
  const [recolhido, setRecolhido] = useState<boolean>(false);

  // Estados de checagem do KDS (:3001) para conflito C04
  const [isModalPendenciasOpen, setIsModalPendenciasOpen] = useState<boolean>(false);
  const [pendenciasKds, setPendenciasKds] = useState<ItemPendenciaModal[]>([]);
  const [isChecandoPendencias, setIsChecandoPendencias] = useState<boolean>(false);

  // Comanda efetiva (detalhes frescos do useComanda ou item da lista de salão)
  const comanda: Comanda | null =
    comandaAtualizada ||
    comandasDisponiveis.find((c) => c.id === comandaAtivaId) ||
    null;

  const itens: ItemComanda[] = comanda?.itens || [];
  const possuiItens = itens.length > 0;
  const isFechada = comanda?.status === 'fechada';
  const isPaga = comanda?.status === 'paga';
  const isCancelada = comanda?.status === 'cancelada';
  const isBloqueada = isFechada || isPaga || isCancelada;

  // Subtotal calculado a partir dos itens copiados ou vindo da API
  const subtotalNumero = itens.reduce((acc, it) => {
    return acc + Number(it.preco_copiado || 0) * it.quantidade;
  }, 0);

  // Se já está fechada, usa os valores persistidos no backend (snapshot oficial);
  // se ainda estiver aberta, calcula a prévia com ou sem a taxa de 10%
  const taxa10Valor = taxa10 ? Math.round(subtotalNumero * 0.1 * 100) / 100 : 0;
  const totalCalculado = subtotalNumero + taxa10Valor;

  const subtotalExibido = comanda?.subtotal ? Number(comanda.subtotal) : subtotalNumero;
  const taxaServicoExibida = isFechada
    ? Number(comanda?.taxa_servico || 0)
    : taxa10Valor;
  const totalExibido = comanda?.total ? Number(comanda.total) : totalCalculado;

  // Alteração de quantidade (+ / -) com feedback otimista e travamento de múltiplos cliques
  const handleAlterarQuantidade = async (
    itemId: number,
    quantidadeAtual: number,
    delta: number
  ) => {
    if (isBloqueada || itemMutatingId !== null || !comanda) return;
    const novaQuantidade = quantidadeAtual + delta;

    setItemMutatingId(itemId);
    try {
      if (novaQuantidade <= 0) {
        await removerItemMut.mutateAsync({ comandaId: comanda.id, itemId });
        onToast('sucesso', 'Item removido da comanda.');
      } else {
        await ajustarItemMut.mutateAsync({
          comandaId: comanda.id,
          itemId,
          dto: { quantidade: novaQuantidade },
        });
      }
    } catch (err) {
      onToast(
        'erro',
        err instanceof ApiError ? err.message : 'Erro ao ajustar quantidade do item.'
      );
    } finally {
      setItemMutatingId(null);
    }
  };

  const handleRemoverItem = async (itemId: number) => {
    if (isBloqueada || itemMutatingId !== null || !comanda) return;
    setItemMutatingId(itemId);
    try {
      await removerItemMut.mutateAsync({ comandaId: comanda.id, itemId });
      onToast('sucesso', 'Item removido da comanda.');
    } catch (err) {
      onToast(
        'erro',
        err instanceof ApiError ? err.message : 'Erro ao remover item da comanda.'
      );
    } finally {
      setItemMutatingId(null);
    }
  };

  const executarFechamento = async () => {
    if (!comanda) return;
    try {
      const comandaFechada = await fecharComandaMut.mutateAsync({
        comandaId: comanda.id,
        dto: { aplicar_taxa_servico: taxa10 },
      });
      onToast('sucesso', `Mesa ${comanda.mesa} fechada para conferência e pagamento.`);
      onAbrirModalPagamento(comandaFechada);
    } catch (err) {
      onToast(
        'erro',
        err instanceof ApiError
          ? `${err.codigo}: ${err.message}`
          : 'Erro ao fechar comanda para cobrança.'
      );
    }
  };

  // Disparo do fluxo de Cobrança / Fechamento com checagem de pendências no KDS
  const handleCobrarClick = async () => {
    if (!comanda) {
      onToast('erro', 'Nenhuma mesa ou comanda selecionada.');
      return;
    }
    if (isCancelada) {
      onToast('erro', 'Esta comanda foi cancelada e não pode ser cobrada.');
      return;
    }
    if (!possuiItens) {
      onToast('erro', 'A comanda está sem itens. Adicione itens antes de cobrar.');
      return;
    }

    // Se comanda já está fechada, abre o modal de pagamento diretamente
    if (comanda.status === 'fechada') {
      onAbrirModalPagamento(comanda);
      return;
    }

    // Se comanda ainda estiver 'aberta', consulta pendências no KDS (:3001) com timeout de 2000ms
    setIsChecandoPendencias(true);
    try {
      const resKds = await obterPendenciasComanda(comanda.id);
      if (resKds.offline) {
        onToast('info', 'KDS indisponível. Confirme visualmente se os pedidos da mesa já foram entregues.');
      } else if (resKds.possui_pendencias && resKds.pendencias.length > 0) {
        setPendenciasKds(resKds.pendencias);
        setIsModalPendenciasOpen(true);
        return;
      }
      await executarFechamento();
    } catch {
      await executarFechamento();
    } finally {
      setIsChecandoPendencias(false);
    }
  };

  // Versão recolhida: trilho fino com resumo (mesa, itens e total) e botão para expandir
  if (recolhido) {
    return (
      <aside
        className="w-[72px] min-w-[72px] max-w-[72px] h-full flex flex-col items-center gap-4 py-4 bg-surface border-l border-border select-none z-10"
        aria-label="Painel de comanda recolhido"
      >
        <button
          type="button"
          onClick={() => setRecolhido(false)}
          className="w-11 h-11 rounded-input bg-surface-2 border border-border text-text hover:bg-border/40 flex items-center justify-center transition-colors"
          title="Expandir comanda"
          aria-label="Expandir comanda"
          aria-expanded={false}
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>

        <div className="relative">
          <Receipt className="w-6 h-6 text-text-2" />
          {itens.length > 0 && (
            <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-brand text-on-brand text-[10px] font-black flex items-center justify-center">
              {itens.reduce((acc, it) => acc + it.quantidade, 0)}
            </span>
          )}
        </div>

        {comanda && (
          <div className="text-center font-bold text-xs text-text-2">
            <span>Mesa</span>
            <div className="text-sm font-black text-text">{comanda.mesa}</div>
          </div>
        )}

        <div className="mt-auto flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold text-text-2 uppercase rotate-[-90deg] whitespace-nowrap mb-6">
            {formatCurrency(totalExibido)}
          </span>
          <button
            type="button"
            onClick={handleCobrarClick}
            disabled={!comanda || !possuiItens || fecharComandaMut.isPending || isChecandoPendencias || isPaga || isCancelada}
            className={`w-11 h-11 rounded-input flex items-center justify-center transition-colors ${
              !comanda || !possuiItens || isPaga || isCancelada
                ? 'bg-surface-2 text-text-2/40 cursor-not-allowed'
                : 'bg-brand text-on-brand hover:opacity-95'
            }`}
            title="Cobrar (F8)"
            aria-label="Cobrar comanda"
          >
            <CreditCard className="w-5 h-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="w-[440px] min-w-[440px] max-w-[440px] h-full flex flex-col bg-surface border-l border-border select-none z-10"
      aria-label="Painel de comanda ativa"
    >
      {/* 1. Topo: Cabeçalho com Seleção de Comanda e Recolhimento */}
      <div className="px-5 py-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand" />
            <h2 className="text-base font-black text-text tracking-tight">Comanda Ativa</h2>
          </div>

          <div className="flex items-center gap-2">
            {comanda && (
              <Badge
                variant={
                  isPaga
                    ? 'success'
                    : isFechada
                    ? 'danger'
                    : isCancelada
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
              >
                {isPaga
                  ? 'Paga'
                  : isFechada
                  ? 'Aguardando Pagamento'
                  : isCancelada
                  ? 'Cancelada'
                  : 'Aberta'}
              </Badge>
            )}

            <button
              type="button"
              onClick={() => setRecolhido(true)}
              className="p-1.5 rounded-input text-text-2 hover:bg-surface-2 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Recolher painel da comanda"
              aria-label="Recolher painel"
              aria-expanded={true}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdown de Comandas/Mesas em Aberto */}
        <div className="relative">
          <select
            value={comandaAtivaId || ''}
            onChange={(e) => onSelecionarComanda(Number(e.target.value))}
            className="w-full min-h-[44px] px-3.5 pr-9 py-2 rounded-input bg-surface-2 border border-border text-text text-sm font-bold appearance-none cursor-pointer focus:outline-none focus:border-text shadow-soft"
            aria-label="Selecionar comanda em aberto"
          >
            {comandasDisponiveis.length === 0 && (
              <option value="">Nenhuma mesa em atendimento</option>
            )}
            {comandasDisponiveis.map((cmd) => (
              <option key={cmd.id} value={cmd.id}>
                Mesa {cmd.mesa} {cmd.nome_cliente ? `• ${cmd.nome_cliente}` : ''} ({cmd.status})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-text-2 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Metadados: Cliente e Tempo Aberta */}
        {comanda && (
          <div className="flex items-center justify-between text-xs text-text-2 pt-0.5">
            <button
              type="button"
              onClick={onAbrirModalCliente}
              className="flex items-center gap-1.5 hover:text-text transition-colors text-left truncate max-w-[240px]"
              title="Vincular cliente ou CPF/CNPJ à nota"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {nomeCliente || comanda.nome_cliente || (documentoCliente ? `CPF ${documentoCliente}` : 'Adicionar Cliente / CPF')}
              </span>
            </button>

            <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-text-2" />
              <span>{formatElapsedTime(comanda.aberta_em)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Corpo: Lista de Itens Rolável com Rolagem Suave */}
      <div
        className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-border/60 min-h-0"
        aria-label="Lista de itens da comanda"
      >
        {!comanda ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-2 gap-2 p-6">
            <Receipt className="w-10 h-10 stroke-[1.25] opacity-40 text-text-2" />
            <p className="text-sm font-semibold">Nenhuma mesa selecionada.</p>
            <p className="text-xs text-text-2/70 max-w-[220px]">
              Selecione uma mesa na aba lateral ou abra um novo atendimento.
            </p>
          </div>
        ) : itens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-2 gap-2 p-6">
            <Receipt className="w-10 h-10 stroke-[1.25] opacity-40 text-text-2" />
            <p className="text-sm font-semibold">Comanda sem itens lançados.</p>
            <p className="text-xs text-text-2/70 max-w-[220px]">
              Clique nos produtos do catálogo ao lado para adicionar pedidos.
            </p>
          </div>
        ) : (
          itens.map((item) => {
            const isMutating = itemMutatingId === item.id;
            const precoUnit = Number(item.preco_copiado || 0);
            const subtotalItem = precoUnit * item.quantidade;

            return (
              <div
                key={item.id}
                className="py-3 flex items-start justify-between gap-3 group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text truncate">
                      {item.nome_copiado}
                    </span>
                  </div>
                  <div className="text-xs text-text-2 mt-0.5">
                    {formatCurrency(precoUnit)} un
                    {item.quantidade > 1 && (
                      <span className="ml-1 text-[11px] font-mono text-text-2">
                        × {item.quantidade} = {formatCurrency(subtotalItem)}
                      </span>
                    )}
                  </div>
                  {item.observacao && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 italic mt-0.5">
                      Obs: {item.observacao}
                    </div>
                  )}
                </div>

                {/* Controles de Quantidade (+ / - / Lixeira) */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {!isBloqueada ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAlterarQuantidade(item.id, item.quantidade, -1)}
                        disabled={isMutating}
                        className="w-8 h-8 rounded-input bg-surface-2 hover:bg-border/60 text-text flex items-center justify-center transition-colors disabled:opacity-40"
                        title={item.quantidade === 1 ? 'Remover item' : 'Diminuir quantidade'}
                        aria-label={`Diminuir ${item.nome_copiado}`}
                      >
                        {item.quantidade === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <span className="w-6 text-center text-sm font-black font-mono tabular-nums">
                        {item.quantidade}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAlterarQuantidade(item.id, item.quantidade, 1)}
                        disabled={isMutating}
                        className="w-8 h-8 rounded-input bg-surface-2 hover:bg-border/60 text-text flex items-center justify-center transition-colors disabled:opacity-40"
                        title="Aumentar quantidade"
                        aria-label={`Aumentar ${item.nome_copiado}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoverItem(item.id)}
                        disabled={isMutating}
                        className="w-8 h-8 rounded-input text-text-2 hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors ml-0.5 disabled:opacity-40"
                        title="Remover linha completa"
                        aria-label={`Excluir ${item.nome_copiado}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm font-black font-mono tabular-nums px-2 py-1 bg-surface-2 rounded-input">
                      {item.quantidade}x
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Rodapé Fixo: Totais, Taxa de 10% e Botão de Cobrança (F8) */}
      <div className="p-5 border-t border-border bg-surface shrink-0 space-y-4">
        {/* Alternância da Taxa de Serviço de 10% */}
        <div className="flex items-center justify-between py-1 border-b border-border/60">
          <div>
            <div className="text-xs font-bold text-text">Taxa de Serviço (10%)</div>
            <div className="text-[11px] text-text-2">
              {isFechada
                ? 'Valor registrado ao fechar a comanda.'
                : 'Opcional (conforme Lei das Gorjetas).'}
            </div>
          </div>

          {isFechada ? (
            <span className="text-xs font-mono font-bold text-text">
              {taxaServicoExibida > 0 ? formatCurrency(taxaServicoExibida) : 'Não aplicada'}
            </span>
          ) : (
            <ToggleSwitch
              checked={taxa10}
              onChange={onTaxa10Change}
              disabled={isBloqueada}
              label={taxa10 ? 'Aplicar 10%' : 'Sem 10%'}
            />
          )}
        </div>

        {/* Linhas de Subtotal e Taxa */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-text-2">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatCurrency(subtotalExibido)}</span>
          </div>

          {taxaServicoExibida > 0 && (
            <div className="flex justify-between text-text-2">
              <span>Gorjeta (10%)</span>
              <span className="font-mono tabular-nums text-text">
                +{formatCurrency(taxaServicoExibida)}
              </span>
            </div>
          )}
        </div>

        {/* Opção secundária: Cancelamento Seguro de Comanda */}
        {comanda && !isPaga && !isCancelada && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => onCancelarComanda(comanda)}
              className="text-xs font-semibold text-danger hover:underline flex items-center gap-1.5 min-h-[32px] px-2 rounded-input hover:bg-danger/10 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancelar comanda...</span>
            </button>
          </div>
        )}

        {/* Botão de Cobrança Gigante (F8) */}
        <button
          onClick={handleCobrarClick}
          disabled={!comanda || !possuiItens || fecharComandaMut.isPending || isChecandoPendencias || isPaga || isCancelada}
          className={`w-full h-[68px] min-h-[68px] px-6 rounded-card font-black text-lg flex items-center justify-between transition-all duration-150 select-none shadow-soft active:scale-[0.99] ${
            !comanda || !possuiItens || isPaga || isCancelada
              ? 'bg-surface-2 text-text-2/60 cursor-not-allowed border border-border'
              : 'bg-brand text-on-brand hover:opacity-95 cursor-pointer'
          }`}
          title="Fechar comanda e abrir tela de pagamento (F8)"
          aria-label="Cobrar comanda"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-input bg-on-brand/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-on-brand" />
            </div>
            <div className="text-left">
              <span className="block leading-none">
                {fecharComandaMut.isPending || isChecandoPendencias
                  ? 'Verificando/Fechando...'
                  : 'Cobrar (F8)'}
              </span>
              <span className="text-xs font-semibold opacity-80 leading-tight">
                {comanda?.status === 'fechada' ? 'Abrir pagamento' : 'Fechar & quitar'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xl tabular-nums font-black leading-none block">
              {formatCurrency(totalExibido)}
            </span>
          </div>
        </button>
      </div>

      {/* Diálogo C04: Conflito de Encerramento (KDS :3001) */}
      <ModalPendenciasKds
        isOpen={isModalPendenciasOpen}
        mesa={comanda?.mesa}
        pendencias={pendenciasKds}
        isLoading={fecharComandaMut.isPending}
        onAguardarEntrega={() => {
          setIsModalPendenciasOpen(false);
          setPendenciasKds([]);
          onToast('info', 'Fechamento pausado. Aguardando entrega dos pedidos da mesa.');
        }}
        onFecharMesmoAssim={async () => {
          setIsModalPendenciasOpen(false);
          setPendenciasKds([]);
          await executarFechamento();
        }}
      />
    </aside>
  );
};
