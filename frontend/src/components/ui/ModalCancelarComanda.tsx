import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export const FRASE_CANCELAMENTO = 'cancelar comanda';

export type MotivoCancelamento =
  | 'Desistência do cliente'
  | 'Erro de digitação do garçom'
  | 'Outro';

export interface ModalCancelarComandaProps {
  isOpen: boolean;
  mesa?: string | number;
  isLoading?: boolean;
  onClose: () => void;
  onConfirmar: (motivo?: string) => void;
}

/**
 * Modal C13 - Cancelamento Seguro de Comanda
 * Conformidade com DESIGN.md §16 e SRS:
 * 1. Alerta crítico de ação destrutiva
 * 2. Seleção de motivo (Radio buttons: Desistência do cliente, Erro de digitação do garçom, Outro)
 * 3. Digitação obrigatória da frase "cancelar comanda" para habilitar o botão de confirmação
 */
export const ModalCancelarComanda: React.FC<ModalCancelarComandaProps> = ({
  isOpen,
  mesa,
  isLoading = false,
  onClose,
  onConfirmar,
}) => {
  const [textoConfirmacao, setTextoConfirmacao] = useState('');
  const [motivoSelecionado, setMotivoSelecionado] =
    useState<MotivoCancelamento>('Desistência do cliente');
  const [outroMotivoTexto, setOutroMotivoTexto] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTextoConfirmacao('');
      setMotivoSelecionado('Desistência do cliente');
      setOutroMotivoTexto('');
    }
  }, [isOpen]);

  const fraseCorreta =
    textoConfirmacao.trim().toLowerCase() === FRASE_CANCELAMENTO;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraseCorreta || isLoading) return;

    const motivoFinal =
      motivoSelecionado === 'Outro'
        ? outroMotivoTexto.trim() || 'Outro motivo não especificado'
        : motivoSelecionado;

    onConfirmar(motivoFinal);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelar Comanda"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {/* Banner de Atenção Crítica (Tomate #C4391D) */}
        <div className="flex items-start gap-3 p-3.5 rounded-card bg-danger-soft border border-danger/30 text-danger-text">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">
              {mesa ? `Comanda da Mesa ${mesa}` : 'Esta comanda'} será cancelada permanentemente.
            </p>
            <p className="leading-relaxed">
              A mesa será desocupada e liberada no salão. Os itens lançados não serão cobrados e
              não haverá baixa de estoque. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        {/* Motivo do Cancelamento (Radio buttons) */}
        <div>
          <label className="text-xs font-bold uppercase text-text-2 tracking-wider block mb-2">
            Motivo do Cancelamento
          </label>
          <div className="space-y-2">
            {(
              [
                'Desistência do cliente',
                'Erro de digitação do garçom',
                'Outro',
              ] as MotivoCancelamento[]
            ).map((motivo) => (
              <label
                key={motivo}
                className={`flex items-center gap-3 p-3 rounded-input border cursor-pointer transition-colors ${
                  motivoSelecionado === motivo
                    ? 'bg-brand-soft/50 border-brand-edge'
                    : 'bg-surface border-border hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="motivo-cancelamento"
                  value={motivo}
                  checked={motivoSelecionado === motivo}
                  onChange={() => setMotivoSelecionado(motivo)}
                  className="w-4 h-4 text-brand focus:ring-brand accent-[#F2A81D]"
                />
                <span className="text-xs font-semibold text-text">{motivo}</span>
              </label>
            ))}
          </div>

          {/* Campo extra se motivo for "Outro" */}
          {motivoSelecionado === 'Outro' && (
            <div className="mt-2.5 animate-fadeIn">
              <input
                type="text"
                value={outroMotivoTexto}
                onChange={(e) => setOutroMotivoTexto(e.target.value)}
                placeholder="Descreva brevemente o motivo..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-input bg-surface border border-border text-text text-xs focus:outline-none focus:border-brand-edge focus:ring-1 focus:ring-brand-edge"
              />
            </div>
          )}
        </div>

        {/* Campo de confirmação estrita da frase */}
        <div>
          <label
            htmlFor="input-frase-cancelamento"
            className="text-xs font-bold text-text-2 block mb-1.5"
          >
            Para confirmar, digite <strong className="text-text">{FRASE_CANCELAMENTO}</strong>
          </label>
          <input
            id="input-frase-cancelamento"
            type="text"
            value={textoConfirmacao}
            onChange={(e) => setTextoConfirmacao(e.target.value)}
            disabled={isLoading}
            autoFocus
            autoComplete="off"
            placeholder={FRASE_CANCELAMENTO}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-input bg-surface border border-border text-text text-sm font-medium focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger disabled:opacity-60"
          />
        </div>

        {/* Rodapé com Botões */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            Voltar
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!fraseCorreta || isLoading}
            isLoading={isLoading}
            className="min-h-[44px] font-bold"
            data-testid="btn-confirmar-cancelamento"
          >
            Cancelar Comanda
          </Button>
        </div>
      </form>
    </Modal>
  );
};
