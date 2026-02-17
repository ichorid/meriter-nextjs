'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { formatMerits } from '@/lib/utils/currency';

export interface WalletQuotaBlockProps {
  balance: number;
  remainingQuota: number;
  dailyQuota: number;
  currencyIconUrl?: string;
  className?: string;
}

/**
 * Compact wallet and quota display block
 * Shows wallet balance and daily quota in a tiny, right-aligned format
 */
export const WalletQuotaBlock: React.FC<WalletQuotaBlockProps> = ({
  balance,
  remainingQuota,
  dailyQuota,
  currencyIconUrl,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-end gap-0.5 text-right ${className}`}>
      {/* Wallet balance row */}
      <div className="flex items-center gap-1 text-xs text-base-content/70">
        {currencyIconUrl && (
          <img 
            src={currencyIconUrl} 
            alt="Currency" 
            className="w-3 h-3 flex-shrink-0" 
          />
        )}
        <span>:</span>
        <span className="font-medium">{formatMerits(balance)}</span>
      </div>

      {/* Quota row */}
      <div className="flex items-center gap-1 text-xs text-base-content/70">
        <Zap className="w-3 h-3 flex-shrink-0" />
        <span>:</span>
        <span className="font-medium">{remainingQuota} / {dailyQuota}</span>
      </div>
    </div>
  );
};

