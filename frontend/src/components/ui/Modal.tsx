import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="fixed inset-0 bg-text/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full rounded-card-lg bg-surface border border-border shadow-modal p-6 text-left transition-all z-10',
          maxWidths[maxWidth]
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-btn text-text-2 hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5 text-text" />
        </button>

        {title && (
          <div className="mb-4 pr-10">
            <h2 className="text-xl font-bold text-text leading-tight">{title}</h2>
            {description && <p className="text-xs text-text-2 mt-1">{description}</p>}
          </div>
        )}

        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
};
