import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEAL_DEADLINE_NOT_FUTURE_MESSAGE,
  formatDeadlineLabel,
  instantToLocalInput,
  isInstantTooSoon,
  isLocalDayTooSoon,
  localInputToInstant,
  mapDeadlineError,
  minimumLocalDeadline,
  monthGrid,
} from '@/lib/local-datetime';

describe('local calendar conversion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('converts UTC instants to UTC-7, UTC and UTC+7 datetime-local values', () => {
    expect(instantToLocalInput('2026-08-14T11:00:00Z', 420)).toBe('2026-08-14T04:00');
    expect(instantToLocalInput('2026-08-14T11:00:00Z', 0)).toBe('2026-08-14T11:00');
    expect(instantToLocalInput('2026-08-14T11:00:00Z', -420)).toBe('2026-08-14T18:00');
  });

  it('converts datetime-local values back to the same UTC instant', () => {
    expect(localInputToInstant('2026-08-14T04:00', 420).toISOString()).toBe('2026-08-14T11:00:00.000Z');
    expect(localInputToInstant('2026-08-14T11:00', 0).toISOString()).toBe('2026-08-14T11:00:00.000Z');
    expect(localInputToInstant('2026-08-14T18:00', -420).toISOString()).toBe('2026-08-14T11:00:00.000Z');
  });

  it('rolls the calendar date across midnight in both directions', () => {
    expect(instantToLocalInput('2026-08-14T02:00:00Z', 420)).toBe('2026-08-13T19:00');
    expect(localInputToInstant('2026-08-13T19:00', 420).toISOString()).toBe('2026-08-14T02:00:00.000Z');
    expect(instantToLocalInput('2026-08-14T20:00:00Z', -420)).toBe('2026-08-15T03:00');
    expect(localInputToInstant('2026-08-15T03:00', -420).toISOString()).toBe('2026-08-14T20:00:00.000Z');
  });

  it('applies DST-style offset changes for the same wall clock', () => {
    expect(instantToLocalInput('2026-01-15T12:00:00Z', 480)).toBe('2026-01-15T04:00');
    expect(localInputToInstant('2026-01-15T04:00', 480).toISOString()).toBe('2026-01-15T12:00:00.000Z');
    expect(instantToLocalInput('2026-07-15T12:00:00Z', 420)).toBe('2026-07-15T05:00');
    expect(localInputToInstant('2026-07-15T05:00', 420).toISOString()).toBe('2026-07-15T12:00:00.000Z');
  });

  it('reads the system timezone offset when none is passed', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
    expect(instantToLocalInput('2026-08-14T11:00:00Z')).toBe('2026-08-14T18:00');
    expect(localInputToInstant('2026-08-14T18:00').toISOString()).toBe('2026-08-14T11:00:00.000Z');
  });

  it('sets the client min to now plus five minutes in local calendar parts', () => {
    vi.setSystemTime(new Date('2026-08-14T11:00:00.000Z'));
    expect(minimumLocalDeadline(undefined, -420)).toBe('2026-08-14T18:05');
    expect(minimumLocalDeadline(new Date('2026-08-14T11:00:00.000Z'), 0)).toBe('2026-08-14T11:05');
  });

  it('maps DEAL_DEADLINE_NOT_FUTURE to dedicated Russian copy', () => {
    expect(mapDeadlineError('DEAL_DEADLINE_NOT_FUTURE')).toBe(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
    expect(DEAL_DEADLINE_NOT_FUTURE_MESSAGE).toMatch(/5 минут/);
    expect(mapDeadlineError('FORBIDDEN')).toBeNull();
  });

  it('builds a Monday-first month grid and labels local instants without datetime-local', () => {
    const cells = monthGrid(2026, 8);
    expect(cells[0]).toEqual({ year: 2026, month: 7, day: 27, inMonth: false });
    expect(cells[5]).toEqual({ year: 2026, month: 8, day: 1, inMonth: true });
    expect(cells).toHaveLength(42);
    expect(formatDeadlineLabel('2026-08-14T11:00:00Z', -420)).toBe('14 авг. 2026, 18:00');
    expect(isInstantTooSoon(new Date('2026-08-14T11:04:00.000Z'), new Date('2026-08-14T11:00:00.000Z'))).toBe(true);
    expect(isLocalDayTooSoon(2026, 8, 13, new Date('2026-08-14T11:00:00.000Z'), 0)).toBe(true);
    expect(isLocalDayTooSoon(2026, 8, 14, new Date('2026-08-14T11:00:00.000Z'), 0)).toBe(false);
  });
});
