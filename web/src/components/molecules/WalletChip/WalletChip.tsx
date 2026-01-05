'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { DailyQuotaRing } from '@/components/molecules/DailyQuotaRing';

export interface WalletChipProps {
  balance: number;
  quota: number;
  currencyIconUrl?: string;
  onClick?: () => void;
  className?: string;
  // Props for the quota ring
  quotaRemaining?: number;
  quotaMax?: number;
  showRing?: boolean;
  flashTrigger?: number;
  variant?: 'default' | 'golden';
}

export const WalletChip: React.FC<WalletChipProps> = ({
  balance,
  quota,
  currencyIconUrl,
  onClick,
  className = '',
  quotaRemaining,
  quotaMax,
  showRing = false,
  flashTrigger,
  variant = 'default',
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        absolute left-1/2 -translate-x-1/2
        bg-base-100 shadow-none rounded-full
        shadow-lg px-3 py-1.5
        flex items-center gap-2
        hover:bg-base-200 transition-colors
        z-[100]
        ${className}
      `}
      type="button"
    >
      {/* Show balance and separator only if ring is not enabled */}
      {!showRing && (
        <>
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
        </>
      )}

      {/* Quota section - show ring if enabled, otherwise show old display */}
      {showRing && quotaRemaining !== undefined && quotaMax !== undefined ? (
        <DailyQuotaRing
          remaining={quotaRemaining}
          max={quotaMax}
          onClick={onClick}
          className="w-[30px] h-[30px]"
          asDiv={true}
          flashTrigger={flashTrigger}
          variant={variant}
        />
      ) : (
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 flex-shrink-0 text-base-content" />
          <span className="text-xs font-semibold text-base-content">
            {quota}
          </span>
        </div>
      )}
    </button>
  );
};

