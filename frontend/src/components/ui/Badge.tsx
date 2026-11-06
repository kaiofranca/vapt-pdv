import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'livre' | 'ocupada' | 'conta_pedida' | 'fechada' | 'esgotado' | 'brand' | 'neutral' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className,
  ...props
}) => {
  const variants = {
    livre: 'bg-success-soft text-success border border-success/25 font-semibold',
    ocupada: 'bg-brand-soft text-brand-text border border-brand/30 font-semibold',
    conta_pedida: 'bg-danger-soft text-danger border border-danger/30 font-bold animate-pulse',
    fechada: 'bg-surface-2 text-text-2 border border-border font-medium',
    esgotado: 'bg-danger-soft text-danger border border-danger/30 font-semibold',
    brand: 'bg-brand text-on-brand font-bold',
    neutral: 'bg-surface-2 text-text-2 border border-border font-medium',
    success: 'bg-success-soft text-success border border-success/25 font-semibold',
    danger: 'bg-danger-soft text-danger border border-danger/30 font-semibold',
    warning: 'bg-brand-soft text-brand-text border border-brand/30 font-semibold',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full leading-none shrink-0 tracking-wide select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
