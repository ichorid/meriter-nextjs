/**
 * Client-side RSVP / QR lock (must match server: `event-participant.helper.ts` in API).
 * Effective start: UTC date from `eventStartDate` + optional `eventTime` HH:MM as UTC on that day.
 */
export function getEffectiveEventStartTimeMs(pub: {
  eventStartDate?: string | Date | null;
  eventTime?: string | null;
}): number | null {
  if (pub.eventStartDate == null) return null;
  const start =
    pub.eventStartDate instanceof Date ? pub.eventStartDate : new Date(pub.eventStartDate);
  if (Number.isNaN(start.getTime())) return null;
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const t = (pub.eventTime ?? '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (match) {
    const hh = Math.min(23, Math.max(0, parseInt(match[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(match[2], 10)));
    return Date.UTC(y, m, d, hh, mm, 0, 0);
  }
  return Date.UTC(y, m, d, 0, 0, 0, 0);
}

export function isEventStartedClient(pub: Parameters<typeof getEffectiveEventStartTimeMs>[0]): boolean {
  const ms = getEffectiveEventStartTimeMs(pub);
  if (ms == null) return false;
  return Date.now() >= ms;
}

export type EventParticipantLite = {
  userId: string;
  attendance?: 'checked_in' | 'no_show' | null;
};

export function findParticipantLite(rows: EventParticipantLite[] | undefined, userId: string) {
  return rows?.find((r) => r.userId === userId);
}

export function isParticipantRsvpLockedClient(
  pub: Parameters<typeof getEffectiveEventStartTimeMs>[0],
  userId: string,
  participants?: EventParticipantLite[],
): boolean {
  if (isEventStartedClient(pub)) return true;
  const row = findParticipantLite(participants, userId);
  if (row?.attendance === 'checked_in' || row?.attendance === 'no_show') return true;
  return false;
}
