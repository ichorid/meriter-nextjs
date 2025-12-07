'use client';

import React from 'react';
import { Zap } from 'lucide-react';

export interface WalletChipProps {
  balance: number;
  quota: number;
  currencyIconUrl?: string;
  onClick?: () => void;
  className?: string;
}

export const WalletChip: React.FC<WalletChipProps> = ({
  balance,
  quota,
  currencyIconUrl,
  onClick,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        absolute left-1/2 -translate-x-1/2
        bg-base-100 border border-base-300 rounded-full
        shadow-lg px-3 py-1.5
        flex items-center gap-2
        hover:bg-base-200 transition-colors
        z-[100]
        ${className}
      `}
      type="button"
    >
      {/* Balance with currency icon */}
      <div className="flex items-center gap-1.5">
        {currencyIconUrl && (
          <img 
            src={currencyIconUrl} 
            alt="Currency" 
            className="w-3.5 h-3.5 flex-shrink-0" 
          />
        )}
        <span className="text-xs font-semibold text-base-content">
          {balance}
        </span>
      </div>

      {/* Separator */}
      <span className="text-base-content/40 text-xs">|</span>

      {/* Quota with lightning icon */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 flex-shrink-0 text-base-content" />
        <span className="text-xs font-semibold text-base-content">
          {quota}
        </span>
      </div>
    </button>
  );
};

