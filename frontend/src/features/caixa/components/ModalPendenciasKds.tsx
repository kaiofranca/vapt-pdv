import React, { useState } from 'react';
import { AlertTriangle, Clock, ChefHat, Wine } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export interface ItemPendenciaModal {
  id: number;
  item_comanda_id?: number;
  produto_id?: number;
  nome_produto: string;
  setor?: string;
  estacao?: string;
  status: string;
  quantidade?: number;
  recebido_em?: string;
}

export interface ModalPendenciasKdsProps {
  isOpen: boolean;
  mesa?: number | string;
  pendencias: ItemPendenciaModal[];
  isLoading?: boolean;
  onAguardarEntrega: () => void;
  onFecharMesmoAssim: () => void;
  onClose?: () => void;
}

/**
 * Modal C04 — Conflito de Encerramento de Comanda com Itens em Preparo no KDS.
 * (Story 2.2.9, RF23, C04, DESIGN.md)
 * 
 * Exibe alerta âmbar e lista detalhada de pedidos ainda não entregues, oferecendo:
 * - "Aguardar Entrega": Aborta o encerramento e mantém a comanda aberta no salão.
 * - "Fechar Mesmo Assim": Prossegue com o fechamento sob consentimento explícito do operador.
 */
export const ModalPendenciasKds: React.FC<ModalPendenciasKdsProps> = ({
  isOpen,
  mesa,
  pendencias,
  isLoading = false,
  onAguardarEntrega,
  onFecharMesmoAssim,
  onClose,
}) => {
  const [ciente, setCiente] = useState(false);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onAguardarEntrega();
    }
  };

  const formatarStatus = (status: string) => {
    switch (status) {
      case 'recebido':
        return 'Recebido';
      case 'em_preparo':
        return 'Em preparo';
      case 'pronto':
        return 'Pronto (Aguardando entrega)';
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_preparo':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300';
      case 'pronto':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300';
      case 'recebido':
      default:
        return 'bg-brand/15 text-brand-coffee border-brand/30 dark:bg-amber-900/40 dark:text-amber-200';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="C04 Conflito de Encerramento"
      description={mesa ? `Mesa ${mesa} possui pedidos pendentes no KDS` : 'Pedidos em preparo no KDS'}
      maxWidth="md"
    >
      <div className="space-y-4 py-1" data-testid="modal-pendencias-kds">
        {/* Banner de Alerta Âmbar (Aviso de Conflito de Encerramento) */}
        <div className="flex items-start gap-3 p-3.5 rounded-card bg-amber-500/15 border border-amber-500/40 text-brand-coffee dark:text-amber-200 shadow-soft">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm text-text">
              {mesa ? `A Mesa ${mesa} possui pedidos não entregues no KDS` : 'Esta comanda possui pedidos não entregues no KDS'}
            </p>
            <p className="leading-relaxed text-text-2">
              Existem pratos ou bebidas ainda em preparo ou aguardando entrega na cozinha ou bar. O fechamento agora pode gerar desperdício e insatisfação do cliente.
            </p>
          </div>
        </div>

        {/* Lista Detalhada de Cada Item Pendente */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase text-text-2 tracking-wider">
              Pedidos Não Entregues ({pendencias.length})
            </label>
            <span className="text-[11px] text-text-2 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              KDS Ativo
            </span>
          </div>

          <div
            className="space-y-2 max-h-56 overflow-y-auto pr-1"
            role="list"
            aria-label="Lista de pedidos pendentes"
          >
            {pendencias.map((item, index) => {
              const setorNormalizado = (item.setor || item.estacao || 'cozinha').toLowerCase();
              const isBar = setorNormalizado === 'bar';
              const quantidade = item.quantidade !== undefined ? item.quantidade : 1;

              return (
                <div
                  key={item.id || item.item_comanda_id || index}
                  role="listitem"
                  className="flex items-center justify-between p-3 rounded-input bg-surface-2/60 border border-border hover:border-border-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isBar
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                      }`}
                      title={isBar ? 'Setor: Bar' : 'Setor: Cozinha'}
                    >
                      {isBar ? <Wine className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-brand-coffee dark:text-amber-300">
                          {quantidade}x
                        </span>
                        <span className="text-xs font-bold text-text">
                          {item.nome_produto}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-text-2 uppercase">
                          Setor: {isBar ? 'Bar' : 'Cozinha'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {formatarStatus(item.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkbox de Consentimento do Operador (EARS-PEND-08) */}
        <label className="flex items-center gap-2.5 p-2 rounded-input bg-surface-2/40 border border-border cursor-pointer select-none">
          <input
            type="checkbox"
            id="check-confirmar-pendencias"
            name="confirmar-pendencias"
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
            className="w-4 h-4 text-brand rounded focus:ring-brand accent-[#F2A81D]"
          />
          <span className="text-xs font-medium text-text">
            Estou ciente de que há itens em preparo e confirmo o encerramento sob minha responsabilidade
          </span>
        </label>

        {/* Duas ações claras: "Aguardar Entrega" e "Fechar Mesmo Assim" */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] min-w-[140px] font-bold"
            onClick={onAguardarEntrega}
            disabled={isLoading}
          >
            Aguardar Entrega
          </Button>

          <Button
            type="button"
            variant="primary"
            className="min-h-[44px] min-w-[160px] font-bold bg-[#F2A81D] text-[#2B2019] hover:bg-[#d99414] border-0"
            onClick={onFecharMesmoAssim}
            isLoading={isLoading}
          >
            Fechar Mesmo Assim
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ModalPendenciasKds;
