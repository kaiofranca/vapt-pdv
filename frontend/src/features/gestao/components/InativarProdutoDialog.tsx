import React, { useState } from 'react';
import { AlertTriangle, PackageX } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useInativarProduto } from '../../../hooks/useProdutos';
import type { Produto } from '../types';

export interface InativarProdutoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produtoParaInativar: Produto | null;
  onInativadoComSucesso?: (produto: Produto) => void;
}

export const InativarProdutoDialog: React.FC<InativarProdutoDialogProps> = ({
  isOpen,
  onClose,
  produtoParaInativar,
  onInativadoComSucesso,
}) => {
  const inativarProdutoMut = useInativarProduto();
  const [erroApi, setErroApi] = useState<string | null>(null);

  if (!produtoParaInativar) return null;

  const handleConfirmar = async () => {
    setErroApi(null);
    try {
      const produtoInativado = await inativarProdutoMut.mutateAsync(produtoParaInativar.id);
      onInativadoComSucesso?.(produtoInativado);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErroApi(err.message);
      } else {
        setErroApi('Não foi possível inativar o produto. Tente novamente.');
      }
    }
  };

  const isProcessando = inativarProdutoMut.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inativar Produto"
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 pt-2">
        {erroApi && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{erroApi}</span>
          </div>
        )}

        <div className="flex items-start gap-4 p-4 rounded-xl bg-danger/5 border border-danger/20">
          <div className="p-3 rounded-full bg-danger/10 text-danger shrink-0">
            <PackageX className="w-6 h-6" />
          </div>
          <div className="flex-1 text-sm text-text leading-relaxed">
            <p className="font-semibold text-text mb-1">
              Confirmação de Inativação Lógica (RN14)
            </p>
            <p className="text-text-2">
              Deseja inativar o item{' '}
              <strong className="text-text font-bold">
                {produtoParaInativar.nome}
              </strong>
              ? Ele não estará mais visível no cardápio do garçom, mas seu histórico de pedidos será preservado.
            </p>
            <p className="text-xs text-text-2/80 mt-2">
              Categoria:{' '}
              <span className="capitalize font-semibold text-text">
                {produtoParaInativar.categoria}
              </span>{' '}
              · Saldo em estoque:{' '}
              <span className="font-semibold text-text">
                {produtoParaInativar.estoque} un
              </span>
            </p>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isProcessando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isProcessando}
            leftIcon={<PackageX className="w-4 h-4" />}
            onClick={handleConfirmar}
          >
            Confirmar Inativação
          </Button>
        </div>
      </div>
    </Modal>
  );
};
