import React, { useState } from 'react';
import { AlertTriangle, UserX } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useInativarUsuario } from '../../../hooks/useUsuarios';
import type { Usuario } from '../types';

export interface InativarUsuarioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  usuarioParaInativar?: Usuario | null;
  onInativadoComSucesso?: (usuario: Usuario) => void;
}

export const InativarUsuarioDialog: React.FC<InativarUsuarioDialogProps> = ({
  isOpen,
  onClose,
  usuarioParaInativar,
  onInativadoComSucesso,
}) => {
  const inativarUsuarioMut = useInativarUsuario();
  const [erroApi, setErroApi] = useState<string | null>(null);

  if (!usuarioParaInativar) return null;

  const handleConfirmar = async () => {
    setErroApi(null);
    try {
      const usuarioInativado = await inativarUsuarioMut.mutateAsync(usuarioParaInativar.id);
      onInativadoComSucesso?.(usuarioInativado);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErroApi(err.message);
      } else {
        setErroApi('Não foi possível inativar o colaborador. Tente novamente.');
      }
    }
  };

  const isProcessando = inativarUsuarioMut.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inativar Colaborador"
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
            <UserX className="w-6 h-6" />
          </div>
          <div className="flex-1 text-sm text-text leading-relaxed">
            <p className="font-semibold text-text mb-1">
              Confirmação de Inativação Lógica
            </p>
            <p className="text-text-2">
              Tem certeza que deseja inativar{' '}
              <strong className="text-text font-bold">
                {usuarioParaInativar.nome}
              </strong>{' '}
              (Perfil:{' '}
              <span className="capitalize font-semibold text-text">
                {usuarioParaInativar.perfil}
              </span>
              )?
            </p>
            <p className="text-xs text-text-2/80 mt-2">
              O colaborador perderá imediatamente a capacidade de operar no sistema, mas todo o seu histórico de vendas, atendimentos e comandas será preservado integralmente no banco de dados.
            </p>
          </div>
        </div>

        {/* Rodapé */}
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
            leftIcon={<UserX className="w-4 h-4" />}
            onClick={handleConfirmar}
          >
            Confirmar Inativação
          </Button>
        </div>
      </div>
    </Modal>
  );
};
