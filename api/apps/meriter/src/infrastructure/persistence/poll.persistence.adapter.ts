import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollSchemaClass, PollDocument } from '../../domain/models/poll/poll.schema';
import {
  POLL_PERSISTENCE_PORT,
  type CommunityPollsQuery,
  type InsertPollInput,
  type PollPartialUpdate,
  type PollPersistencePort,
  type PollPersistenceSession,
  type PollSnapshot,
} from '../../domain/ports/poll.persistence.port';
import {
  mapPollDocumentToSnapshot,
  mapPollSnapshotToDocument,
} from './mappers/poll.mapper';

@Injectable()
export class PollPersistenceAdapter implements PollPersistencePort {
  constructor(
    @InjectModel(PollSchemaClass.name) private readonly pollModel: Model<PollDocument>,
  ) {}

  async insertPoll(input: InsertPollInput, _session?: PollPersistenceSession): Promise<void> {
    await this.pollModel.create(mapPollSnapshotToDocument(input));
  }

  async findById(id: string, _session?: PollPersistenceSession): Promise<PollSnapshot | null> {
    const doc = await this.pollModel.findOne({ id }).lean().exec();
    return doc ? mapPollDocumentToSnapshot(doc as PollSnapshot) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.pollModel.deleteOne({ id }).exec();
  }

  async countActiveByCommunity(communityId: string): Promise<number> {
    return this.pollModel.countDocuments({ communityId, isActive: true });
  }

  async findByCommunity(query: CommunityPollsQuery): Promise<PollSnapshot[]> {
    const mongoQuery: Record<string, unknown> = {
      communityId: query.communityId,
      isActive: true,
    };

    if (query.search?.trim()) {
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      mongoQuery.$or = [{ question: searchRegex }, { description: searchRegex }];
    }

    const sort: Record<string, 1 | -1> =
      query.sortBy === 'score' ? { 'metrics.totalAmount': -1 } : { createdAt: -1 };

    const docs = await this.pollModel
      .find(mongoQuery)
      .limit(query.limit)
      .skip(query.skip)
      .sort(sort)
      .lean()
      .exec();

    return docs.map((doc) => mapPollDocumentToSnapshot(doc as PollSnapshot));
  }

  async findActiveNotExpired(limit: number, skip: number): Promise<PollSnapshot[]> {
    const docs = await this.pollModel
      .find({ isActive: true, expiresAt: { $gt: new Date() } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => mapPollDocumentToSnapshot(doc as PollSnapshot));
  }

  async updateSnapshot(
    id: string,
    snapshot: PollSnapshot,
    _session?: PollPersistenceSession,
  ): Promise<void> {
    await this.pollModel.updateOne({ id }, { $set: mapPollSnapshotToDocument(snapshot) });
  }

  async countByFilter(filter: Record<string, unknown>): Promise<number> {
    return this.pollModel.countDocuments(filter);
  }

  async findByFilter(
    filter: Record<string, unknown>,
    limit: number,
    skip: number,
  ): Promise<PollSnapshot[]> {
    const docs = await this.pollModel
      .find(filter)
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((doc) => mapPollDocumentToSnapshot(doc as PollSnapshot));
  }

  async partialUpdate(id: string, update: PollPartialUpdate): Promise<void> {
    await this.pollModel.updateOne({ id }, { $set: update });
  }
}

export const pollPersistenceProvider = {
  provide: POLL_PERSISTENCE_PORT,
  useClass: PollPersistenceAdapter,
};
