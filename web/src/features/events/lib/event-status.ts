export type EventStatus = 'upcoming' | 'active' | 'past';

export function getEventStatus(start: Date, end: Date, now: Date = new Date()): EventStatus {
  if (now < start) {
    return 'upcoming';
  }
  if (now > end) {
    return 'past';
  }
  return 'active';
}

/** Whole days until start (ceil); null if start is in the past or now. */
export function getDaysUntilEventStart(start: Date, now: Date = new Date()): number | null {
  const ms = start.getTime() - now.getTime();
  if (ms <= 0) {
    return null;
  }
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
