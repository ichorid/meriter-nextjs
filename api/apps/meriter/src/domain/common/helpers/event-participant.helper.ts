/**
 * Event RSVP + attendance helpers.
 *
 * Effective event start: UTC calendar day from `eventStartDate` + optional `eventTime` (HH:MM)
 * interpreted as UTC wall time on that day (see business-events.mdc).
 * RSVP time lock uses **`eventEndDate`** when set; otherwise start time (legacy).
 */
export type EventAttendanceValue = 'checked_in' | 'no_show';

export interface EventParticipantRow {
  userId: string;
  attendance?: EventAttendanceValue | null;
  attendanceUpdatedAt?: Date;
  attendanceUpdatedByUserId?: string;
}

export function parseEventParticipantsFromDoc(doc: {
  eventParticipants?: unknown;
  eventAttendees?: string[] | null;
}): EventParticipantRow[] {
  const raw = doc.eventParticipants;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: EventParticipantRow[] = [];
    for (const p of raw) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const userId = typeof o.userId === 'string' ? o.userId : null;
      if (!userId) continue;
      const att = o.attendance;
      const attendance: EventAttendanceValue | null =
        att === 'checked_in' || att === 'no_show' ? att : null;
      out.push({
        userId,
        attendance,
        attendanceUpdatedAt:
          o.attendanceUpdatedAt instanceof Date
            ? o.attendanceUpdatedAt
            : o.attendanceUpdatedAt
              ? new Date(String(o.attendanceUpdatedAt))
              : undefined,
        attendanceUpdatedByUserId:
          typeof o.attendanceUpdatedByUserId === 'string'
            ? o.attendanceUpdatedByUserId
            : undefined,
      });
    }
    return out;
  }
  const legacy = doc.eventAttendees ?? [];
  return legacy.map((userId) => ({ userId, attendance: null as EventAttendanceValue | null }));
}

export function attendeeIdsFromParticipants(rows: EventParticipantRow[]): string[] {
  return rows.map((r) => r.userId);
}

/** Milliseconds for the moment the event is considered "started" for RSVP lock. */
export function getEffectiveEventStartTimeMs(doc: {
  eventStartDate?: Date | string | null;
  eventTime?: string | null;
}): number | null {
  if (doc.eventStartDate == null) return null;
  const start = doc.eventStartDate instanceof Date ? doc.eventStartDate : new Date(doc.eventStartDate);
  if (Number.isNaN(start.getTime())) return null;
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const t = (doc.eventTime ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (match) {
    const hh = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    return Date.UTC(y, m, d, hh, mm, 0, 0);
  }
  return Date.UTC(y, m, d, 0, 0, 0, 0);
}

export function isEventStarted(doc: Parameters<typeof getEffectiveEventStartTimeMs>[0], now = new Date()): boolean {
  const ms = getEffectiveEventStartTimeMs(doc);
  if (ms == null) return false;
  return now.getTime() >= ms;
}

/** Instant when the event is considered over for RSVP lock (full datetime from publication). */
export function getEffectiveEventEndTimeMs(doc: { eventEndDate?: Date | string | null }): number | null {
  if (doc.eventEndDate == null) return null;
  const end = doc.eventEndDate instanceof Date ? doc.eventEndDate : new Date(doc.eventEndDate);
  if (Number.isNaN(end.getTime())) return null;
  return end.getTime();
}

/**
 * After `eventEndDate` when present; otherwise falls back to start time (legacy events without end).
 */
export function isEventEnded(
  doc: Parameters<typeof getEffectiveEventStartTimeMs>[0] & { eventEndDate?: Date | string | null },
  now = new Date(),
): boolean {
  const endMs = getEffectiveEventEndTimeMs(doc);
  if (endMs != null) return now.getTime() >= endMs;
  return isEventStarted(doc, now);
}

export function findParticipantRow(
  rows: EventParticipantRow[],
  userId: string,
): EventParticipantRow | undefined {
  return rows.find((r) => r.userId === userId);
}

/** User cannot change own RSVP after the event ends (or after start if no `eventEndDate`), or when attendance is set. */
export function isParticipantRsvpLocked(
  doc: Parameters<typeof getEffectiveEventStartTimeMs>[0] & { eventEndDate?: Date | string | null },
  userId: string,
  rows: EventParticipantRow[],
  now = new Date(),
): boolean {
  if (isEventEnded(doc, now)) return true;
  const row = findParticipantRow(rows, userId);
  if (row?.attendance === 'checked_in' || row?.attendance === 'no_show') return true;
  return false;
}
