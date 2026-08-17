'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, inputClass } from '@/components/ui';
import {
  formatDeadlineLabel,
  instantFromLocalParts,
  isInstantTooSoon,
  isLocalDayTooSoon,
  localPartsFromInstant,
  monthGrid,
  shiftLocalMonth,
} from '@/lib/local-datetime';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];
const MONTH_TITLE = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

function monthTitle(year: number, month: number): string {
  const raw = MONTH_TITLE.format(new Date(Date.UTC(year, month - 1, 1)));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const MONTHS_LONG_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function dayLabel(year: number, month: number, day: number): string {
  return `${day} ${MONTHS_LONG_RU[month - 1]} ${year}`;
}

function nextValidInstant(now: Date): Date {
  const min = new Date(now.getTime() + 5 * 60_000);
  const step = 15 * 60_000;
  return new Date(Math.ceil(min.getTime() / step) * step);
}

export function DeadlinePicker({
  id,
  value,
  onChange,
  label,
  hint,
}: {
  id: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  label: string;
  hint?: string;
}) {
  const now = new Date();
  const initial = localPartsFromInstant(value ?? now);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? localPartsFromInstant(value) : null;
  const cells = useMemo(() => monthGrid(view.year, view.month), [view.month, view.year]);
  const minuteOptions = selected && !MINUTES.includes(selected.minute)
    ? [...MINUTES, selected.minute].sort((left, right) => left - right)
    : MINUTES;

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  function pickDay(year: number, month: number, day: number) {
    if (isLocalDayTooSoon(year, month, day, now)) return;
    const fallback = nextValidInstant(now);
    const fallbackParts = localPartsFromInstant(fallback);
    const candidate = instantFromLocalParts({
      year,
      month,
      day,
      hour: selected?.hour ?? fallbackParts.hour,
      minute: selected?.minute ?? fallbackParts.minute,
    });
    onChange(isInstantTooSoon(candidate, now) ? instantFromLocalParts({
      year,
      month,
      day,
      hour: fallbackParts.hour,
      minute: fallbackParts.minute,
    }) : candidate);
  }

  function pickTime(hour: number, minute: number) {
    if (!selected) {
      const fallback = localPartsFromInstant(nextValidInstant(now));
      onChange(instantFromLocalParts({ ...fallback, hour, minute }));
      return;
    }
    onChange(instantFromLocalParts({ ...selected, hour, minute }));
  }

  return (
    <div ref={rootRef} className="space-y-1.5 text-sm">
      <span id={`${id}-label`} className="font-medium text-stitch-text">{label}</span>
      <div className="flex gap-2">
        <button
          id={id}
          type="button"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
          className={cn(inputClass, 'flex flex-1 items-center justify-between text-left')}
        >
          <span>{value ? formatDeadlineLabel(value) : 'Не указан'}</span>
          <span className="text-stitch-muted">{open ? '▴' : '▾'}</span>
        </button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>
            Сбросить
          </Button>
        ) : null}
      </div>
      {open ? (
        <div
          role="dialog"
          aria-label="Календарь срока"
          className="space-y-3 rounded-xl border border-stitch-border bg-stitch-canvas p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stitch-muted hover:bg-stitch-accent/10 hover:text-stitch-text"
              aria-label="Предыдущий месяц"
              onClick={() => setView((current) => shiftLocalMonth(current, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold capitalize">{monthTitle(view.year, view.month)}</p>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stitch-muted hover:bg-stitch-accent/10 hover:text-stitch-text"
              aria-label="Следующий месяц"
              onClick={() => setView((current) => shiftLocalMonth(current, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-stitch-muted">
            {WEEKDAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
            {cells.map((cell) => {
              const disabled = isLocalDayTooSoon(cell.year, cell.month, cell.day, now);
              const isSelected = selected?.year === cell.year && selected.month === cell.month && selected.day === cell.day;
              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}`}
                  type="button"
                  disabled={disabled}
                  aria-label={dayLabel(cell.year, cell.month, cell.day)}
                  aria-pressed={isSelected}
                  onClick={() => pickDay(cell.year, cell.month, cell.day)}
                  className={cn(
                    'min-h-11 rounded-lg text-sm disabled:cursor-not-allowed disabled:opacity-30',
                    cell.inMonth ? 'text-stitch-text' : 'text-stitch-muted/60',
                    isSelected ? 'bg-stitch-accent-solid text-white' : 'hover:bg-stitch-accent/10',
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-stitch-muted">
              Часы
              <select
                className={inputClass}
                disabled={!selected}
                value={selected?.hour ?? 12}
                onChange={(event) => pickTime(Number(event.target.value), selected?.minute ?? 0)}
              >
                {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-stitch-muted">
              Минуты
              <select
                className={inputClass}
                disabled={!selected}
                value={selected?.minute ?? 0}
                onChange={(event) => pickTime(selected?.hour ?? 12, Number(event.target.value))}
              >
                {minuteOptions.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Готово</Button>
          </div>
        </div>
      ) : null}
      {hint ? <p className="text-xs leading-5 text-stitch-muted">{hint}</p> : null}
    </div>
  );
}
