// VoteBar molecule component
'use client';

import React from 'react';
import { Button } from '@/components/atoms/Button';

interface VoteBarProps {
  plus: number;
  minus: number;
  sum: number;
  onVote: (direction: 'plus' | 'minus', amount: number) => void;
  maxPlus?: number;
  maxMinus?: number;
  disabled?: boolean;
  className?: string;
}

export const VoteBar: React.FC<VoteBarProps> = ({
  plus,
  minus,
  sum,
  onVote,
  maxPlus = 100,
  maxMinus = 100,
  disabled = false,
  className = '',
}) => {
  const handleVote = (direction: 'plus' | 'minus', amount: number = 1) => {
    if (disabled) return;
    onVote(direction, amount);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('plus')}
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
        onClick={() => handleVote('minus')}
        disabled={disabled || maxMinus <= 0}
        className="text-error hover:bg-error/10"
      >
        {minus}
      </Button>
    </div>
  );
};
