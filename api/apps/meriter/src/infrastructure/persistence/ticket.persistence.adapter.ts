import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import {
  TICKET_PERSISTENCE_PORT,
  type TicketPersistencePort,
  type TicketRecord,
  type TicketMutableRecord,
} from '../../domain/ports/ticket.persistence.port';

function toRecord(doc: PublicationDocument | Record<string, unknown>): TicketRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return row as TicketRecord;
}

@Injectable()
export class TicketPersistenceAdapter implements TicketPersistencePort {
  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async create(input: Record<string, unknown>): Promise<TicketRecord> {
    const doc = await this.publicationModel.create(input);
    return toRecord(doc);
  }

  async findOne(
    filter: Record<string, unknown>,
  ): Promise<TicketMutableRecord | null> {
    const doc = await this.publicationModel.findOne(filter).exec();
    return doc ? (doc as unknown as TicketMutableRecord) : null;
  }

  async findOneLean(
    filter: Record<string, unknown>,
    select?: Record<string, 0 | 1 | boolean> | string,
  ): Promise<TicketRecord | null> {
    const query = this.publicationModel.findOne(filter);
    if (select) {
      query.select(select);
    }
    const row = await query.lean().exec();
    return row ? (row as TicketRecord) : null;
  }

  async findMany(
    filter: Record<string, unknown>,
    options?: {
      sort?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
    },
  ): Promise<TicketRecord[]> {
    const query = this.publicationModel.find(filter);
    if (options?.sort) {
      query.sort(options.sort);
    }
    if (options?.skip !== undefined) {
      query.skip(options.skip);
    }
    if (options?.limit !== undefined) {
      query.limit(options.limit);
    }
    const rows = await query.lean().exec();
    return rows as TicketRecord[];
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<void> {
    await this.publicationModel.updateOne(filter, update).exec();
  }

  async aggregateProjectContributors(
    projectId: string,
  ): Promise<Array<{ _id: string; internalMerits: number }>> {
    const pipeline = [
      {
        $match: {
          communityId: projectId,
          deleted: { $ne: true },
          postType: { $in: ['ticket', 'discussion'] },
          status: 'active',
        },
      },
      {
        $project: {
          score: { $ifNull: ['$metrics.score', 0] },
          effectiveUserId: {
            $cond: {
              if: { $eq: ['$postType', 'ticket'] },
              then: { $ifNull: ['$beneficiaryId', '$authorId'] },
              else: '$authorId',
            },
          },
        },
      },
      {
        $group: {
          _id: '$effectiveUserId',
          internalMerits: { $sum: '$score' },
        },
      },
      { $match: { _id: { $ne: null } } },
    ];

    return this.publicationModel.aggregate<{ _id: string; internalMerits: number }>(
      pipeline,
    );
  }
}

export const ticketPersistenceProvider = {
  provide: TICKET_PERSISTENCE_PORT,
  useClass: TicketPersistenceAdapter,
};
