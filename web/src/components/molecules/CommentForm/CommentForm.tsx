// CommentForm molecule component
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/atoms/Button';

interface CommentFormProps {
  onSubmit: (comment: string, amount: number, directionPlus: boolean) => void;
  onCancel: () => void;
  maxAmount: number;
  initialAmount?: number;
  initialDirection?: boolean;
  loading?: boolean;
  className?: string;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  onCancel,
  maxAmount,
  initialAmount = 1,
  initialDirection = true,
  loading = false,
  className = '',
}) => {
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState(initialAmount);
  const [directionPlus, setDirectionPlus] = useState(initialDirection);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || amount <= 0) return;
    onSubmit(comment, amount, directionPlus);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Enter your comment..."
          className="textarea textarea-bordered w-full"
          rows={3}
          required
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="label cursor-pointer">
            <input
              type="radio"
              name="direction"
              className="radio radio-success"
              checked={directionPlus}
              onChange={() => setDirectionPlus(true)}
            />
            <span className="label-text ml-2">Positive</span>
          </label>
          <label className="label cursor-pointer">
            <input
              type="radio"
              name="direction"
              className="radio radio-error"
              checked={!directionPlus}
              onChange={() => setDirectionPlus(false)}
            />
            <span className="label-text ml-2">Negative</span>
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="label">
            <span className="label-text">Amount:</span>
          </label>
          <input
            type="number"
            min="1"
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input input-bordered input-sm w-20"
            required
          />
        </div>
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
          disabled={!comment.trim() || amount <= 0}
        >
          Submit
        </Button>
      </div>
    </form>
  );
};
