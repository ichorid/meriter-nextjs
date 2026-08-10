import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';
import {
  EventInviteSchemaClass,
  EventInviteDocument,
} from '../../domain/models/event-invite/event-invite.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import {
  EVENT_PERSISTENCE_PORT,
  type EventInviteSnapshot,
  type EventParticipantRow,
  type EventPersistencePort,
  type EventPersistenceSession,
  type InsertEventInviteInput,
} from '../../domain/ports/event.persistence.port';
import {
  mapEventInviteDocumentToSnapshot,
  mapEventInviteSnapshotToDocument,
  mapEventParticipantsToDocument,
  mapEventPublicationDocumentToSnapshot,
} from './mappers/event.mapper';

function sessionOpts(session?: EventPersistenceSession) {
  return session ? { session: session as ClientSession } : undefined;
}

@Injectable()
export class EventPersistenceAdapter implements EventPersistencePort {
  constructor(
    @InjectModel(EventInviteSchemaClass.name)
    private readonly eventInviteModel: Model<EventInviteDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async findInviteByToken(token: string): Promise<EventInviteSnapshot | null> {
    const doc = await this.eventInviteModel.findOne({ token }).lean().exec();
    return doc ? mapEventInviteDocumentToSnapshot(doc as EventInviteSnapshot) : null;
  }

  async createInvite(input: InsertEventInviteInput): Promise<EventInviteSnapshot> {
    const created = await this.eventInviteModel.create(mapEventInviteSnapshotToDocument(input));
    return mapEventInviteDocumentToSnapshot(created.toObject() as EventInviteSnapshot);
  }

  async findEventPublicationById(id: string): Promise<PublicationSnapshot | null> {
    const doc = await this.publicationModel.findOne({ id }).lean().exec();
    return doc ? mapEventPublicationDocumentToSnapshot(doc as PublicationSnapshot) : null;
  }

  async findEventPublicationsByCommunity(communityId: string): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({
        communityId,
        postType: 'event',
        deleted: { $ne: true },
      })
      .lean()
      .exec();
    return docs.map((doc) => mapEventPublicationDocumentToSnapshot(doc as PublicationSnapshot));
  }

  async updateEventParticipants(
    publicationId: string,
    participants: EventParticipantRow[],
    attendeeIds: string[],
    session?: EventPersistenceSession,
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $set: mapEventParticipantsToDocument(participants, attendeeIds) },
      sessionOpts(session),
    );
  }
}

export const eventPersistenceProvider = {
  provide: EVENT_PERSISTENCE_PORT,
  useClass: EventPersistenceAdapter,
};
