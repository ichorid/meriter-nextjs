export function formatEventDateRange(
  start: string | Date,
  end: string | Date,
  time?: string | null,
): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateFmt = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const range = sameDay
    ? dateFmt.format(startDate)
    : `${dateFmt.format(startDate)} — ${dateFmt.format(endDate)}`;
  return time?.trim() ? `${range}, ${time.trim()}` : range;
}

export function toDatetimeLocalValue(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
