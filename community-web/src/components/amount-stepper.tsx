'use client';

import { hapticSelection } from '@/lib/telegram-env';

type AmountStepperProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

export function AmountStepper({
  value,
  min = 1,
  max = 9999,
  onChange,
}: AmountStepperProps) {
  const dec = () => {
    hapticSelection();
    onChange(Math.max(min, value - 1));
  };
  const inc = () => {
    hapticSelection();
    onChange(Math.min(max, value + 1));
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-stitch-border bg-stitch-surface text-lg font-semibold disabled:opacity-40"
        aria-label="Уменьшить"
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-xl font-bold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-stitch-border bg-stitch-surface text-lg font-semibold disabled:opacity-40"
        aria-label="Увеличить"
      >
        +
      </button>
    </div>
  );
}
