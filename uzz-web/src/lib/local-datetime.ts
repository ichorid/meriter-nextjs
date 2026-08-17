const LEAD_MS = 5 * 60_000;

export const DEAL_DEADLINE_NOT_FUTURE_MESSAGE =
  'Срок должен быть хотя бы на 5 минут позже текущего времени';

function two(value: number): string {
  return String(value).padStart(2, '0');
}

function parseLocalCalendarParts(value: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    throw new RangeError('Invalid local datetime');
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

export function instantToLocalInput(value: Date | string, offsetMinutes?: number): string {
  const instant = new Date(value);
  const offset = offsetMinutes ?? instant.getTimezoneOffset();
  const local = new Date(instant.getTime() - offset * 60_000);
  return `${local.getUTCFullYear()}-${two(local.getUTCMonth() + 1)}-${two(local.getUTCDate())}T${two(local.getUTCHours())}:${two(local.getUTCMinutes())}`;
}

export function localInputToInstant(value: string, offsetMinutes?: number): Date {
  const parts = parseLocalCalendarParts(value);
  const offset = offsetMinutes ?? new Date(value).getTimezoneOffset();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) + offset * 60_000);
}

export function minimumLocalDeadline(now: Date = new Date(), offsetMinutes?: number): string {
  return instantToLocalInput(new Date(now.getTime() + LEAD_MS), offsetMinutes);
}

export function isDeadlineTooSoon(value: string, now: Date = new Date(), offsetMinutes?: number): boolean {
  return isInstantTooSoon(localInputToInstant(value, offsetMinutes), now);
}

export function isInstantTooSoon(value: Date, now: Date = new Date()): boolean {
  return value.getTime() < now.getTime() + LEAD_MS;
}

export function mapDeadlineError(code: string | undefined | null): string | null {
  return code === 'DEAL_DEADLINE_NOT_FUTURE' ? DEAL_DEADLINE_NOT_FUTURE_MESSAGE : null;
}

export type LocalCalendarParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function localPartsFromInstant(value: Date | string, offsetMinutes?: number): LocalCalendarParts {
  return parseLocalCalendarParts(instantToLocalInput(value, offsetMinutes));
}

export function instantFromLocalParts(parts: LocalCalendarParts, offsetMinutes?: number): Date {
  return localInputToInstant(
    `${parts.year}-${two(parts.month)}-${two(parts.day)}T${two(parts.hour)}:${two(parts.minute)}`,
    offsetMinutes,
  );
}

const MONTHS_RU = [
  'янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.',
];

export function formatDeadlineLabel(value: Date | string, offsetMinutes?: number): string {
  const parts = localPartsFromInstant(value, offsetMinutes);
  return `${parts.day} ${MONTHS_RU[parts.month - 1]} ${parts.year}, ${two(parts.hour)}:${two(parts.minute)}`;
}

export function shiftLocalMonth(parts: Pick<LocalCalendarParts, 'year' | 'month'>, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function earliestInstantOnLocalDay(
  year: number,
  month: number,
  day: number,
  minInstant: Date,
  offsetMinutes?: number,
): Date {
  const start = instantFromLocalParts({ year, month, day, hour: 0, minute: 0 }, offsetMinutes);
  return start.getTime() >= minInstant.getTime() ? start : minInstant;
}

export function isLocalDayTooSoon(
  year: number,
  month: number,
  day: number,
  now: Date = new Date(),
  offsetMinutes?: number,
): boolean {
  const end = instantFromLocalParts({ year, month, day, hour: 23, minute: 59 }, offsetMinutes);
  return isInstantTooSoon(end, now);
}

export function monthGrid(year: number, month: number): Array<{ year: number; month: number; day: number; inMonth: boolean }> {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonth = shiftLocalMonth({ year, month }, -1);
  const daysInPrev = new Date(Date.UTC(prevMonth.year, prevMonth.month, 0)).getUTCDate();
  const cells: Array<{ year: number; month: number; day: number; inMonth: boolean }> = [];
  for (let i = firstWeekday; i > 0; i -= 1) {
    cells.push({ year: prevMonth.year, month: prevMonth.month, day: daysInPrev - i + 1, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ year, month, day, inMonth: true });
  }
  const nextMonth = shiftLocalMonth({ year, month }, 1);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ year: nextMonth.year, month: nextMonth.month, day: nextDay, inMonth: false });
    nextDay += 1;
  }
  return cells;
}
