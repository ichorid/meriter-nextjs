import type { PublicationSnapshot } from '../../../common/interfaces/publication-document.interface';
import type {
  EventInviteSnapshot,
  EventParticipantRow,
} from '../../../domain/ports/event.persistence.port';

/** Lean Mongoose event invite document shape (plain fields). */
export type EventInviteDocumentShape = EventInviteSnapshot;

export function mapEventInviteDocumentToSnapshot(
  doc: EventInviteDocumentShape,
): EventInviteSnapshot {
  return { ...doc };
}

export function mapEventInviteSnapshotToDocument(
  snapshot: EventInviteSnapshot,
): EventInviteDocumentShape {
  return { ...snapshot };
}

export function mapEventPublicationDocumentToSnapshot(
  doc: PublicationSnapshot,
): PublicationSnapshot {
  return doc as PublicationSnapshot;
}

export function mapEventParticipantsToDocument(
  participants: EventParticipantRow[],
  attendeeIds: string[],
): Pick<PublicationSnapshot, 'eventParticipants' | 'eventAttendees'> {
  return {
    eventParticipants: participants.map((row) => ({ ...row })),
    eventAttendees: [...attendeeIds],
  };
}
