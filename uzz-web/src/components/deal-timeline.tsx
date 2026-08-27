import { cn, formatWhen } from '@/lib/utils';

const STEPS = ['requested', 'accepted', 'completed_by_seller', 'closed'] as const;
const labels = ['Заявка', 'Принята', 'Выполнена', 'Закрыта'];

export function DealTimeline({ status, dates }: { status: string; dates: Array<Date | string | null | undefined> }) {
  const terminal = status === 'rejected' || status === 'cancelled' || status === 'expired'; const index = terminal ? 0 : Math.max(0, STEPS.indexOf(status as (typeof STEPS)[number]));
  const terminalLabel = status === 'rejected' ? 'Отклонена' : status === 'expired' ? 'Истекла' : 'Отменена';
  return <ol className="grid grid-cols-4 gap-1" aria-label="Этапы сделки">{labels.map((label, step) => <li key={label} className="min-w-0"><div className={cn('mb-2 h-1 rounded-full', step <= index ? 'bg-stitch-accent' : 'bg-stitch-border')} /><p className={cn('truncate text-[11px] sm:text-xs', step <= index ? 'text-stitch-text' : 'text-stitch-muted')}>{terminal && step === 1 ? terminalLabel : label}</p>{dates[step] ? <p className="mt-0.5 hidden text-[10px] text-stitch-muted sm:block">{formatWhen(dates[step]!)}</p> : null}</li>)}</ol>;
}
