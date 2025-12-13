// CommentForm molecule component with vertical slider
'use client';

import React, { useState, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/Button';
import Slider from 'rc-slider';
import { classList } from '@lib/classList';
import 'rc-slider/assets/index.css';

interface CommentFormProps {
  onSubmit: (comment: string, amount: number, directionPlus: boolean) => void;
  onCancel: () => void;
  maxAmount: number;
  initialAmount?: number;
  initialDirection?: boolean;
  loading?: boolean;
  className?: string;
}

export const CommentForm: React.FC<CommentFormProps> = memo(({
  onSubmit,
  onCancel,
  maxAmount,
  initialAmount = 0,
  initialDirection = true,
  loading = false,
  className = '',
}) => {
  const t = useTranslations('comments');
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState(initialAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === 0) return;
    const directionPlus = amount > 0;
    onSubmit(comment, Math.abs(amount), directionPlus);
  };

  // Memoize onChange handler to prevent unnecessary re-renders
  const handleSliderChange = useCallback((value: number | number[]) => {
    const newAmount = typeof value === 'number' ? value : value[0] || 0;
    setAmount(newAmount);
  }, []);

  const directionPlus = amount > 0;
  const directionMinus = amount < 0;

  return (
    <div className={classList(
      "p-5 rounded-2xl shadow-lg",
      directionPlus ? "bg-success/10" : directionMinus ? "bg-error/10" : "bg-base-100"
    )}>
      <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
        {/* Amount display */}
        <div className="text-center mb-4">
          <div className={classList(
            "text-3xl font-bold",
            directionPlus ? "text-success" : directionMinus ? "text-error" : "text-secondary"
          )}>
            {amount > 0 ? '+' : ''}{amount}
          </div>
          <div className="text-xs opacity-60 mt-1">
            Vote amount
          </div>
        </div>

        {/* Vertical Slider */}
        <div className="mb-4 flex justify-center">
          <div className="relative" style={{ height: '180px' }}>
            <Slider
              vertical={true}
              min={-maxAmount}
              max={maxAmount}
              value={amount}
              onChange={handleSliderChange}
              className="rc-slider-vertical"
            />
            {/* Center zero indicator */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-base-200 border-2 border-base-300 flex items-center justify-center">
                <span className="text-xs font-bold text-base-content">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-sm mb-2 opacity-60 text-center">
          Move up to vote positive, down to vote negative
        </div>

        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={amount === 0 ? t('adjustSliderToVote') : t('addCommentOptional')}
            className="textarea textarea-bordered w-full"
            rows={3}
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            disabled={amount === 0}
          >
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
});

CommentForm.displayName = 'CommentForm';
