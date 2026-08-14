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
  return localInputToInstant(value, offsetMinutes).getTime() < now.getTime() + LEAD_MS;
}

export function mapDeadlineError(code: string | undefined | null): string | null {
  return code === 'DEAL_DEADLINE_NOT_FUTURE' ? DEAL_DEADLINE_NOT_FUTURE_MESSAGE : null;
}
