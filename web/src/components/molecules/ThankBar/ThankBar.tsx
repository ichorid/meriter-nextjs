// ThankBar molecule component
'use client';

import React from 'react';
import { Button } from '@/components/atoms/Button';

interface ThankBarProps {
  plus: number;
  minus: number;
  sum: number;
  onThank: (direction: 'plus' | 'minus', amount: number) => void;
  maxPlus?: number;
  maxMinus?: number;
  disabled?: boolean;
  className?: string;
}

export const ThankBar: React.FC<ThankBarProps> = ({
  plus,
  minus,
  sum,
  onThank,
  maxPlus = 100,
  maxMinus = 100,
  disabled = false,
  className = '',
}) => {
  const handleThank = (direction: 'plus' | 'minus', amount: number = 1) => {
    if (disabled) return;
    onThank(direction, amount);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleThank('plus')}
        disabled={disabled || maxPlus <= 0}
        className="text-success hover:bg-success/10"
      >
        +{plus}
      </Button>
      
      <div className="flex flex-col items-center">
        <span className={`text-sm font-medium ${sum > 0 ? 'text-success' : sum < 0 ? 'text-error' : 'text-base-content'}`}>
          {sum > 0 ? '+' : ''}{sum}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleThank('minus')}
        disabled={disabled || maxMinus <= 0}
        className="text-error hover:bg-error/10"
      >
        {minus}
      </Button>
    </div>
  );
};
