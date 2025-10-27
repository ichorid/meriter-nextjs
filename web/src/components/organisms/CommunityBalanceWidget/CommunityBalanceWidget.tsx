'use client';

import React from 'react';

interface CommunityBalanceWidgetProps {
  balance?: number;
  currencyIcon?: string;
  className?: string;
}

export const CommunityBalanceWidget: React.FC<CommunityBalanceWidgetProps> = ({
  balance = 0,
  currencyIcon,
  className = ''
}) => {
  return (
    <div className={`bg-base-100 shadow-md rounded-lg p-3 flex items-center gap-2 ${className}`}>
      {currencyIcon && (
        <img 
          className="w-5 h-5" 
          src={currencyIcon} 
          alt="Currency" 
        />
      )}
      <div className="flex flex-col">
        <span className="text-xs opacity-60">Balance</span>
        <span className="text-sm font-semibold">{balance}</span>
      </div>
    </div>
  );
};

