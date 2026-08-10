'use client';

import { optionDown, optionNet, optionUp, type PollOptionView } from './poll-types';

type PollOptionBarsProps = {
  option: PollOptionView;
  maxAbsValue: number;
};

function BarRow({
  label,
  value,
  maxAbsValue,
  barClass,
  valueClass,
}: {
  label: string;
  value: number;
  maxAbsValue: number;
  barClass: string;
  valueClass: string;
}) {
  const pct = maxAbsValue > 0 ? Math.min(100, (Math.abs(value) / maxAbsValue) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 text-stitch-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stitch-canvas">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 shrink-0 text-right tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/** За / против / итог progress bars for a single poll option. */
export function PollOptionBars({ option, maxAbsValue }: PollOptionBarsProps) {
  const up = optionUp(option);
  const down = optionDown(option);
  const net = optionNet(option);

  return (
    <div className="space-y-1">
      <BarRow
        label="За"
        value={up}
        maxAbsValue={maxAbsValue}
        barClass="bg-green-400/80"
        valueClass="text-green-400"
      />
      <BarRow
        label="Против"
        value={down}
        maxAbsValue={maxAbsValue}
        barClass="bg-red-400/80"
        valueClass="text-red-400"
      />
      <BarRow
        label="Итог"
        value={net}
        maxAbsValue={maxAbsValue}
        barClass={net >= 0 ? 'bg-primary/70' : 'bg-red-400/50'}
        valueClass={net >= 0 ? 'text-primary' : 'text-red-400'}
      />
    </div>
  );
}
