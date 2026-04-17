'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/shadcn/label';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/utils';

const touchInputClass =
  'min-h-10 w-full min-w-0 max-w-full touch-manipulation text-base md:text-sm';

export function splitToDateTimeParts(d: Date | string): { date: string; time: string } {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return { date: '', time: '09:00' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`,
    time: `${pad(x.getHours())}:${pad(x.getMinutes())}`,
  };
}

export function mergeDateTimeParts(date: string, time: string): Date | null {
  const dStr = date?.trim();
  const tStr = time?.trim();
  if (!dStr || !tStr) return null;
  const d = new Date(`${dStr}T${tStr}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Start at next full hour, end two hours later (local). */
export function defaultEventDateTimeParts(): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  const s = splitToDateTimeParts(start);
  const e = splitToDateTimeParts(end);
  return { startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time };
}

export type EventDateTimeRangeFieldsProps = {
  idPrefix: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  onStartDateChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
};

export function EventDateTimeRangeFields({
  idPrefix,
  startDate,
  startTime,
  endDate,
  endTime,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
}: EventDateTimeRangeFieldsProps) {
  const t = useTranslations('events');
  const locale = useLocale();

  return (
    <div className="min-w-0 space-y-1.5" lang={locale}>
      {/* Stacked: two columns inside max-w-lg dialog overflowed (grid min-width:auto). */}
      <div className="flex min-w-0 flex-col gap-2.5">
        <fieldset className="min-w-0 w-full space-y-2 rounded-lg border border-base-content/15 bg-base-200/30 p-2.5">
          <legend className="px-0.5 text-xs font-semibold text-base-content">{t('fieldStartSection')}</legend>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.75rem] sm:items-end">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`${idPrefix}-start-date`} className="text-[11px] font-medium text-base-content/70">
                {t('fieldDate')}
              </Label>
              <Input
                id={`${idPrefix}-start-date`}
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                required
                className={cn(touchInputClass)}
                autoComplete="off"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:max-w-[7.75rem] sm:justify-self-stretch">
              <Label htmlFor={`${idPrefix}-start-time`} className="text-[11px] font-medium text-base-content/70">
                {t('fieldClockTime')}
              </Label>
              <Input
                id={`${idPrefix}-start-time`}
                type="time"
                step={60}
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                required
                className={cn(touchInputClass)}
                autoComplete="off"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="min-w-0 w-full space-y-2 rounded-lg border border-base-content/15 bg-base-200/30 p-2.5">
          <legend className="px-0.5 text-xs font-semibold text-base-content">{t('fieldEndSection')}</legend>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.75rem] sm:items-end">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`${idPrefix}-end-date`} className="text-[11px] font-medium text-base-content/70">
                {t('fieldDate')}
              </Label>
              <Input
                id={`${idPrefix}-end-date`}
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                required
                className={cn(touchInputClass)}
                autoComplete="off"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:max-w-[7.75rem] sm:justify-self-stretch">
              <Label htmlFor={`${idPrefix}-end-time`} className="text-[11px] font-medium text-base-content/70">
                {t('fieldClockTime')}
              </Label>
              <Input
                id={`${idPrefix}-end-time`}
                type="time"
                step={60}
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                required
                className={cn(touchInputClass)}
                autoComplete="off"
              />
            </div>
          </div>
        </fieldset>
      </div>
      <p className="text-[11px] leading-snug text-base-content/60">{t('eventDateTimeHint')}</p>
    </div>
  );
}
