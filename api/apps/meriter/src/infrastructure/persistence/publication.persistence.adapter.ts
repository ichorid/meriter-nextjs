import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';
import { buildHubPostsFeedMongoQuery } from '../../domain/common/helpers/hub-posts-feed.helper';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type CommunityPublicationsQuery,
  type ClosePublicationInput,
  type InsertPublicationInput,
  type ObPostSummary,
  type PublicationEditHistoryEntry,
  type PublicationForwardProposalInput,
  type PublicationPatchUpdate,
  type PublicationPersistencePort,
  type PublicationPersistenceSession,
  type PublicationQueryListOptions,
  type PublicationVoteUpdate,
} from '../../domain/ports/publication.persistence.port';
import {
  mapPublicationDocumentToSnapshot,
  mapPublicationSnapshotToDocument,
} from './mappers/publication.mapper';

function sessionOpts(session?: PublicationPersistenceSession) {
  return session ? { session: session as ClientSession } : undefined;
}

@Injectable()
export class PublicationPersistenceAdapter implements PublicationPersistencePort {
  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async startSession(): Promise<PublicationPersistenceSession> {
    return this.connection.startSession();
  }

  async findById(
    id: string,
    session?: PublicationPersistenceSession,
  ): Promise<PublicationSnapshot | null> {
    const query = this.publicationModel.findOne({ id });
    if (session) query.session(session as ClientSession);
    const doc = await query.lean().exec();
    return doc ? mapPublicationDocumentToSnapshot(doc as PublicationSnapshot) : null;
  }

  async insertPublication(
    input: InsertPublicationInput,
    session?: PublicationPersistenceSession,
  ): Promise<void> {
    await this.publicationModel.create(
      [mapPublicationSnapshotToDocument(input)],
      sessionOpts(session),
    );
  }

  async updateSnapshot(
    id: string,
    snapshot: PublicationSnapshot,
    session?: PublicationPersistenceSession,
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      { $set: mapPublicationSnapshotToDocument(snapshot) },
      sessionOpts(session),
    );
  }

  async updateWithVoteMetrics(
    id: string,
    update: PublicationVoteUpdate,
    session?: PublicationPersistenceSession,
  ): Promise<void> {
    const updateOp: Record<string, unknown> = {
      $set: mapPublicationSnapshotToDocument(update.snapshot),
    };
    if (update.lifetimeCreditIncrement != null && update.lifetimeCreditIncrement > 0) {
      updateOp.$inc = { lifetimeCredits: update.lifetimeCreditIncrement };
    }
    await this.publicationModel.updateOne({ id }, updateOp, sessionOpts(session));
  }

  async updateWithEditHistory(
    id: string,
    payload: Partial<PublicationSnapshot>,
    editHistoryEntry: PublicationEditHistoryEntry,
    session?: PublicationPersistenceSession,
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      {
        $set: payload,
        $push: { editHistory: editHistoryEntry },
      },
      sessionOpts(session),
    );
  }

  async setPublicationTimestampsForSeed(
    id: string,
    createdAt: Date,
    ttlExpiresAt: Date | null,
  ): Promise<void> {
    const update: Record<string, unknown> = {
      createdAt,
      updatedAt: createdAt,
    };
    if (ttlExpiresAt !== undefined) {
      update.ttlExpiresAt = ttlExpiresAt;
    }
    // Bypass Mongoose timestamps middleware so backdated createdAt sticks (demo seeds).
    await this.publicationModel.collection.updateOne({ id }, { $set: update });
  }

  async updateFutureVisionPostContent(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
    content: string,
  ): Promise<boolean> {
    const updated = await this.publicationModel
      .findOneAndUpdate(
        {
          communityId: futureVisionCommunityId,
          sourceEntityType: 'community',
          sourceEntityId: sourceCommunityId,
          deleted: { $ne: true },
        },
        {
          $set: {
            content,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
    return !!updated;
  }

  async findFutureVisionPostId(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
  ): Promise<string | null> {
    const doc = await this.publicationModel
      .findOne({
        communityId: futureVisionCommunityId,
        sourceEntityType: 'community',
        sourceEntityId: sourceCommunityId,
        deleted: { $ne: true },
      })
      .select('id')
      .lean()
      .exec();
    return doc?.id ?? null;
  }

  async findObPosts(
    futureVisionCommunityId: string,
    params: { sort: 'score' | 'createdAt' },
  ): Promise<ObPostSummary[]> {
    const docs = await this.publicationModel
      .find({
        communityId: futureVisionCommunityId,
        sourceEntityType: 'community',
        deleted: { $ne: true },
      })
      .select('id sourceEntityId metrics.score createdAt')
      .sort(
        params.sort === 'createdAt'
          ? { createdAt: -1 }
          : { 'metrics.score': -1 },
      )
      .lean()
      .exec();

    return docs.map((d) => ({
      id: d.id,
      sourceEntityId: d.sourceEntityId as string,
      metrics: { score: (d as { metrics?: { score?: number } }).metrics?.score ?? 0 },
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
    }));
  }

  async countHubFeedPublicationsByCommunity(communityId: string): Promise<number> {
    return this.publicationModel.countDocuments({
      communityId,
      deleted: { $ne: true },
      content: { $exists: true, $nin: [null, ''] },
      postType: { $nin: ['project', 'event'] },
      isProject: { $ne: true },
    });
  }

  async countProjectHubPosts(projectId: string): Promise<number> {
    return this.publicationModel.countDocuments({
      communityId: projectId,
      deleted: { $ne: true },
      postType: { $in: ['ticket', 'discussion'] },
    });
  }

  async countBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
  ): Promise<number> {
    return this.publicationModel.countDocuments({
      communityId: birzhaCommunityId,
      sourceEntityType,
      sourceEntityId,
      deleted: { $ne: true },
    });
  }

  async findBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({
        communityId: birzhaCommunityId,
        sourceEntityType,
        sourceEntityId,
        deleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async findPublicationsByCommunity(
    query: CommunityPublicationsQuery,
  ): Promise<PublicationSnapshot[]> {
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mongoQuery: Record<string, unknown> = {
      communityId: query.communityId,
      deleted: { $ne: true },
      ...(query.hubPostsFeedOnly ? buildHubPostsFeedMongoQuery() : {}),
    };

    const searchOr =
      query.search && query.search.trim()
        ? (() => {
            const escapedSearch = escapeRe(query.search.trim());
            const searchRegex = new RegExp(escapedSearch, 'i');
            return [
              { content: searchRegex },
              { title: searchRegex },
              { description: searchRegex },
              { hashtags: searchRegex },
            ];
          })()
        : null;

    const valueTagOr =
      query.filters?.valueTags && query.filters.valueTags.length > 0
        ? query.filters.valueTags.map((t) => {
            const escaped = escapeRe(t.trim());
            return { valueTags: new RegExp(`^${escaped}$`, 'i') };
          })
        : null;

    if (searchOr && valueTagOr) {
      mongoQuery.$and = [{ $or: searchOr }, { $or: valueTagOr }];
    } else if (searchOr) {
      mongoQuery.$or = searchOr;
    } else if (valueTagOr) {
      mongoQuery.$or = valueTagOr;
    }

    if (query.hashtag) {
      mongoQuery.hashtags = query.hashtag;
    }

    if (query.pinnedOnly) {
      mongoQuery.isPinned = true;
    } else     if (query.excludePinned) {
      mongoQuery.isPinned = { $ne: true };
    }

    if (query.feedVisibleOnly !== false) {
      const visibleModeration = {
        $or: [
          { telegramModerationStatus: { $exists: false } },
          { telegramModerationStatus: null },
          { telegramModerationStatus: 'approved' },
        ],
      };
      if (Array.isArray(mongoQuery.$and)) {
        mongoQuery.$and.push(visibleModeration);
      } else {
        mongoQuery.$and = [visibleModeration];
      }
    }

    const filters = query.filters;
    if (filters) {
      if (filters.impactArea) mongoQuery.impactArea = filters.impactArea;
      if (filters.stage) mongoQuery.stage = filters.stage;
      if (filters.beneficiaries?.length) {
        mongoQuery.beneficiaries = { $in: filters.beneficiaries };
      }
      if (filters.methods?.length) mongoQuery.methods = { $in: filters.methods };
      if (filters.helpNeeded?.length) {
        mongoQuery.helpNeeded = { $in: filters.helpNeeded };
      }
      if (filters.categories?.length) {
        mongoQuery.categories = { $in: filters.categories };
      }
    }

    const sort: Record<string, 1 | -1> = {};
    if (query.sortBy === 'score') {
      sort['metrics.score'] = -1;
    } else {
      sort.createdAt = -1;
    }

    const docs = await this.publicationModel
      .find(mongoQuery)
      .limit(query.limit)
      .skip(query.skip)
      .sort(sort)
      .lean();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async findTopPublications(limit: number, skip: number): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({ deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async findPublicationsByAuthor(
    authorId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({ authorId, deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async countProfilePublicationsByAuthor(authorId: string): Promise<number> {
    return this.publicationModel.countDocuments({
      authorId,
      deleted: { $ne: true },
      $nor: [{ isProject: true }, { postType: 'project' }],
    });
  }

  async findPublicationsByHashtag(
    hashtag: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({ hashtags: hashtag, deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async findDeletedPublicationsByCommunity(
    communityId: string,
    limit: number,
    skip: number,
  ): Promise<PublicationSnapshot[]> {
    const docs = await this.publicationModel
      .find({ communityId, deleted: true })
      .limit(limit)
      .skip(skip)
      .sort({ deletedAt: -1, createdAt: -1 })
      .lean();
    return docs.map((d) => mapPublicationDocumentToSnapshot(d as PublicationSnapshot));
  }

  async softDelete(id: string): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      { $set: { deleted: true, deletedAt: new Date() } },
    );
  }

  async restore(id: string): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      { $unset: { deleted: '', deletedAt: '' } },
    );
  }

  async updateForwardProposal(
    id: string,
    input: PublicationForwardProposalInput,
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      {
        $set: {
          forwardStatus: 'pending',
          forwardTargetCommunityId: input.targetCommunityId,
          forwardProposedBy: input.proposedBy,
          forwardProposedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  async markAsForwarded(id: string, targetCommunityId: string): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      {
        $set: {
          forwardStatus: 'forwarded',
          forwardTargetCommunityId: targetCommunityId,
          updatedAt: new Date(),
        },
        $unset: {
          forwardProposedBy: '',
          forwardProposedAt: '',
        },
      },
    );
  }

  async clearForwardProposal(id: string): Promise<void> {
    await this.publicationModel.updateOne(
      { id },
      {
        $set: {
          forwardStatus: null,
          updatedAt: new Date(),
        },
        $unset: {
          forwardTargetCommunityId: '',
          forwardProposedBy: '',
          forwardProposedAt: '',
        },
      },
    );
  }

  async findActiveIdsBySource(
    communityId: string,
    sourceEntityType: string,
    sourceEntityId: string,
  ): Promise<string[]> {
    const list = await this.publicationModel
      .find({
        communityId,
        sourceEntityType,
        sourceEntityId,
        status: 'active',
        deleted: { $ne: true },
      })
      .select('id')
      .lean()
      .exec();
    return list.map((d) => d.id);
  }

  async deleteById(id: string): Promise<void> {
    await this.publicationModel.deleteOne({ id });
  }

  async deleteVotesByPublicationId(publicationId: string): Promise<void> {
    if (!this.connection.db) return;
    await this.connection.db
      .collection('votes')
      .deleteMany({ targetType: 'publication', targetId: publicationId });
  }

  async deleteCommentsRecursivelyForPublication(publicationId: string): Promise<void> {
    if (!this.connection.db) {
      throw new Error('Database connection not available');
    }

    const deleteCommentsRecursively = async (
      targetId: string,
      targetType: 'publication' | 'comment',
    ) => {
      const comments = await this.connection.db!
        .collection('comments')
        .find({ targetType, targetId })
        .toArray();

      for (const comment of comments) {
        await deleteCommentsRecursively(comment.id, 'comment');
      }

      if (comments.length > 0) {
        const commentIds = comments.map((c) => c.id);
        await this.connection.db!.collection('comments').deleteMany({ id: { $in: commentIds } });
      }
    };

    await deleteCommentsRecursively(publicationId, 'publication');
  }

  async findByQuery(options: PublicationQueryListOptions): Promise<PublicationSnapshot[]> {
    let query = this.publicationModel.find(options.query);
    if (options.select) {
      query = query.select(options.select);
    }
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.skip !== undefined) {
      query = query.skip(options.skip);
    }
    if (options.limit !== undefined) {
      query = query.limit(options.limit);
    }
    const docs = await query.lean().exec();
    return docs.map((doc) => mapPublicationDocumentToSnapshot(doc as PublicationSnapshot));
  }

  async countByQuery(query: Record<string, unknown>): Promise<number> {
    return this.publicationModel.countDocuments(query);
  }

  private buildMongoPatchUpdate(update: PublicationPatchUpdate): Record<string, unknown> | null {
    const mongoUpdate: Record<string, unknown> = {};
    if (update.set && Object.keys(update.set).length > 0) {
      mongoUpdate.$set = update.set;
    }
    if (update.push && Object.keys(update.push).length > 0) {
      mongoUpdate.$push = update.push;
    }
    if (update.unset && Object.keys(update.unset).length > 0) {
      mongoUpdate.$unset = update.unset;
    }
    if (update.inc && Object.keys(update.inc).length > 0) {
      mongoUpdate.$inc = update.inc;
    }
    return Object.keys(mongoUpdate).length > 0 ? mongoUpdate : null;
  }

  async patchById(
    id: string,
    update: PublicationPatchUpdate,
    session?: PublicationPersistenceSession,
  ): Promise<void> {
    const mongoUpdate = this.buildMongoPatchUpdate(update);
    if (!mongoUpdate) {
      return;
    }
    await this.publicationModel.updateOne({ id }, mongoUpdate, sessionOpts(session));
  }

  async findAndPatchOne(
    filter: Record<string, unknown>,
    update: PublicationPatchUpdate,
    session?: PublicationPersistenceSession,
  ): Promise<PublicationSnapshot | null> {
    const mongoUpdate = this.buildMongoPatchUpdate(update);
    if (!mongoUpdate) {
      const doc = await this.publicationModel.findOne(filter).lean().exec();
      return doc ? mapPublicationDocumentToSnapshot(doc as PublicationSnapshot) : null;
    }
    const doc = await this.publicationModel
      .findOneAndUpdate(filter, mongoUpdate, { new: true, ...sessionOpts(session) })
      .lean()
      .exec();
    return doc ? mapPublicationDocumentToSnapshot(doc as PublicationSnapshot) : null;
  }

  async closePublication(input: ClosePublicationInput): Promise<void> {
    const now = new Date();
    await this.publicationModel.updateOne(
      { id: input.id },
      {
        $set: {
          status: 'closed',
          closedAt: now,
          closeReason: input.reason,
          closingSummary: input.closingSummary,
          investmentPool: 0,
          'metrics.score': 0,
        },
      },
      sessionOpts(input.session),
    );
  }

  async runInTransaction<T>(
    fn: (session: PublicationPersistenceSession) => Promise<T>,
  ): Promise<T> {
    const transactionErrorMsg =
      'Transaction numbers are only allowed on a replica set member or mongos';
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(transactionErrorMsg)) {
        return fn(undefined);
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

export const publicationPersistenceProvider = {
  provide: PUBLICATION_PERSISTENCE_PORT,
  useClass: PublicationPersistenceAdapter,
};
