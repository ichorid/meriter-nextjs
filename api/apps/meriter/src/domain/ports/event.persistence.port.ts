import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';

/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type EventPersistenceSession = unknown;

export const EVENT_PERSISTENCE_PORT = Symbol('EVENT_PERSISTENCE_PORT');

export interface EventParticipantRow {
  userId: string;
  attendance?: 'checked_in' | 'no_show' | null;
  attendanceUpdatedAt?: Date | null;
  attendanceUpdatedByUserId?: string | null;
}

export interface EventInviteSnapshot {
  id: string;
  eventPostId: string;
  token: string;
  maxUses?: number | null;
  usedCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

export interface InsertEventInviteInput {
  id: string;
  eventPostId: string;
  token: string;
  maxUses?: number | null;
  usedCount: number;
  createdBy: string;
  expiresAt?: Date | null;
}

/**
 * EventPersistencePort — BC-09 event persistence (Phase 9 partial).
 *
 * Covers event invite links and event publication participant fields.
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface EventPersistencePort {
  findInviteByToken(token: string): Promise<EventInviteSnapshot | null>;

  createInvite(input: InsertEventInviteInput): Promise<EventInviteSnapshot>;

  findEventPublicationById(id: string): Promise<PublicationSnapshot | null>;

  findEventPublicationsByCommunity(communityId: string): Promise<PublicationSnapshot[]>;

  updateEventParticipants(
    publicationId: string,
    participants: EventParticipantRow[],
    attendeeIds: string[],
    session?: EventPersistenceSession,
  ): Promise<void>;
}
