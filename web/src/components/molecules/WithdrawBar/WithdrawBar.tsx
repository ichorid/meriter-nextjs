import React from 'react';
import { Button, Badge } from '@/components/atoms';

export interface WithdrawBarProps {
  balance: number;
  currency?: string;
  onWithdraw: () => void;
  className?: string;
}

export const WithdrawBar: React.FC<WithdrawBarProps> = ({
  balance,
  currency,
  onWithdraw,
  className = '',
}) => {
  // Don't show withdraw bar if there's nothing to withdraw
  if (!balance || balance <= 0) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between p-3 border-t border-base-200 ${className}`}>
      <div className="flex items-center gap-2">
        <Badge variant="primary" size="sm">
          Available: {balance} {currency || 'tokens'}
        </Badge>
      </div>
      <Button 
        variant="primary" 
        size="sm"
        onClick={onWithdraw}
      >
        Withdraw
      </Button>
    </div>
  );
};
