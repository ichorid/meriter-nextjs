import React from 'react';
import { Icon, Badge } from '@/components/atoms';

export interface VoteIndicatorProps {
  amount: number;
  className?: string;
}

export const VoteIndicator: React.FC<VoteIndicatorProps> = ({ amount, className = '' }) => {
  if (!amount || amount === 0) {
    return null;
  }

  const isPositive = amount > 0;
  const variant = isPositive ? 'success' : 'error';
  const icon = isPositive ? 'add' : 'remove';
  const displayAmount = Math.abs(amount);

  return (
    <Badge variant={variant} size="sm" className={`flex items-center gap-1 ${className}`}>
      <Icon name={icon} size={16} />
      <span>{displayAmount}</span>
    </Badge>
  );
};
