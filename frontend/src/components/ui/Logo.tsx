import React from 'react';

export interface LogoMarkProps {
  size?: number;
  className?: string;
  ariaHidden?: boolean;
}

export const LogoMark: React.FC<LogoMarkProps> = ({
  size = 44,
  className = '',
  ariaHidden = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role={ariaHidden ? 'presentation' : 'img'}
    aria-label={ariaHidden ? undefined : 'VaptPDV'}
    aria-hidden={ariaHidden ? 'true' : undefined}
    className={className}
  >
    <rect width="64" height="64" rx="18" fill="#F2A81D" />
    <path
      d="M17 21 L30 46 L43 21"
      fill="none"
      stroke="#2B2019"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="49" cy="16" r="5" fill="#2B2019" />
    <circle cx="49" cy="16" r="1.8" fill="#F2A81D" />
  </svg>
);

export interface LogoProps {
  size?: number;
  comNome?: boolean;
  fundo?: 'claro' | 'escuro';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 44,
  comNome = false,
  fundo = 'claro',
  className = '',
}) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <LogoMark size={size} ariaHidden={comNome} />
    {comNome && (
      <span
        className={`font-black tracking-tight leading-none text-2xl ${
          fundo === 'escuro' ? 'text-white' : 'text-text'
        }`}
      >
        Vapt<span className="text-brand">PDV</span>
      </span>
    )}
  </div>
);
