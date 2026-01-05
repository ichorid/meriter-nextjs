import React from 'react';
import { Icon } from '@/components/atoms';
import { Button } from '@/components/ui/shadcn/button';

export interface VoteControlsProps {
  amount: number;
  onAmountChange: (amount: number) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  min?: number;
  max?: number;
}

export const VoteControls: React.FC<VoteControlsProps> = ({
  amount,
  onAmountChange,
  onSubmit,
  isLoading = false,
  min = 0,
  max = Infinity,
}) => {
  const handleIncrease = () => {
    if (amount < max) {
      onAmountChange(amount + 1);
    }
  };

  const handleDecrease = () => {
    if (amount > min) {
      onAmountChange(amount - 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDecrease}
        disabled={amount <= min || isLoading}
      >
        <Icon name="remove" size={20} />
      </Button>
      
      <input
        type="number"
        value={amount}
        onChange={(e) => {
          const value = parseInt(e.target.value) || 0;
          onAmountChange(Math.max(min, Math.min(max, value)));
        }}
        className="input input-bordered input-sm w-20 text-center"
        disabled={isLoading}
        min={min}
        max={max}
      />
      
      <Button
        variant="secondary"
        size="sm"
        onClick={handleIncrease}
        disabled={amount >= max || isLoading}
      >
        <Icon name="add" size={20} />
      </Button>
      
      <Button
        variant="primary"
        size="sm"
        onClick={onSubmit}
        isLoading={isLoading}
        disabled={amount === 0}
      >
        Vote
      </Button>
    </div>
  );
};
