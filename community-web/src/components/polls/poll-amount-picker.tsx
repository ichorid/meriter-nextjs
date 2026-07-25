'use client';

import { hapticSelection } from '@/lib/telegram-env';

const PRESETS = [1, 3, 5, 10];

type PollAmountPickerProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function PollAmountPicker({ value, onChange, disabled }: PollAmountPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          disabled={disabled}
          onClick={() => {
            hapticSelection();
            onChange(preset);
          }}
          className={`min-h-[40px] min-w-[48px] rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors disabled:opacity-50 ${
            value === preset
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-stitch-border bg-stitch-canvas text-stitch-text hover:border-primary/50'
          }`}
        >
          {preset}
        </button>
      ))}
      <label className="flex items-center gap-2 text-sm text-stitch-muted">
        Своя
        <input
          type="number"
          min={1}
          disabled={disabled}
          className="w-20 rounded-lg border border-stitch-border bg-stitch-canvas px-2 py-2 text-sm tabular-nums disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
      </label>
    </div>
  );
}
