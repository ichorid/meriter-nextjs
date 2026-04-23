import {
  getEffectiveEventEndTimeMs,
  isEventEnded,
  isParticipantRsvpLocked,
  parseEventParticipantsFromDoc,
} from '../src/domain/common/helpers/event-participant.helper';

describe('event-participant.helper RSVP lock', () => {
  const userId = 'u1';
  const rows = parseEventParticipantsFromDoc({ eventParticipants: [{ userId, attendance: null }] });

  it('does not lock RSVP before end when eventEndDate is set', () => {
    const start = new Date('2026-04-23T19:00:00.000Z');
    const end = new Date('2026-04-23T21:00:00.000Z');
    const now = new Date('2026-04-23T18:30:00.000Z');
    const doc = {
      eventStartDate: start,
      eventTime: '19:00',
      eventEndDate: end,
    };
    expect(getEffectiveEventEndTimeMs(doc)).toBe(end.getTime());
    expect(isEventEnded(doc, now)).toBe(false);
    expect(isParticipantRsvpLocked(doc, userId, rows, now)).toBe(false);
  });

  it('locks RSVP at or after eventEndDate', () => {
    const start = new Date('2026-04-23T19:00:00.000Z');
    const end = new Date('2026-04-23T21:00:00.000Z');
    const now = new Date('2026-04-23T21:00:00.000Z');
    const doc = {
      eventStartDate: start,
      eventTime: '19:00',
      eventEndDate: end,
    };
    expect(isEventEnded(doc, now)).toBe(true);
    expect(isParticipantRsvpLocked(doc, userId, rows, now)).toBe(true);
  });

  it('without eventEndDate, locks at effective start (legacy)', () => {
    const start = new Date('2026-04-23T19:00:00.000Z');
    const now = new Date('2026-04-23T19:30:00.000Z');
    const doc = {
      eventStartDate: start,
      eventTime: '19:00',
    };
    expect(isParticipantRsvpLocked(doc, userId, rows, now)).toBe(true);
  });

  it('locks when attendance is set regardless of time', () => {
    const start = new Date('2026-04-23T19:00:00.000Z');
    const end = new Date('2026-04-23T21:00:00.000Z');
    const now = new Date('2026-04-23T18:00:00.000Z');
    const doc = {
      eventStartDate: start,
      eventTime: '19:00',
      eventEndDate: end,
    };
    const withAttendance = parseEventParticipantsFromDoc({
      eventParticipants: [{ userId, attendance: 'checked_in' }],
    });
    expect(isParticipantRsvpLocked(doc, userId, withAttendance, now)).toBe(true);
  });
});
