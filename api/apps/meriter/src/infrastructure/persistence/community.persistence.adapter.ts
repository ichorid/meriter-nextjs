import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import {
  COMMUNITY_PERSISTENCE_PORT,
  type CommunityArrayField,
  type CommunityListOptions,
  type CommunityPersistencePort,
  type CommunityPersistenceSession,
  type CommunityQueryListOptions,
  type CommunitySnapshot,
  type CommunityUpdatePayload,
  type InsertCommunityInput,
  type ProjectInvestmentEntry,
} from '../../domain/ports/community.persistence.port';
import {
  mapCommunityDocumentToSnapshot,
  mapCommunitySnapshotToDocument,
} from './mappers/community.mapper';

function sessionOpts(session?: CommunityPersistenceSession) {
  return session ? { session: session as ClientSession } : undefined;
}

@Injectable()
export class CommunityPersistenceAdapter implements CommunityPersistencePort {
  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
  ) {}

  async startSession(): Promise<CommunityPersistenceSession> {
    const session = await this.communityModel.db.startSession();
    return session;
  }

  async findById(
    id: string,
    session?: CommunityPersistenceSession,
  ): Promise<CommunitySnapshot | null> {
    const query = this.communityModel.findOne({ id });
    if (session) query.session(session as ClientSession);
    const doc = await query.lean().exec();
    return doc ? mapCommunityDocumentToSnapshot(doc as CommunitySnapshot) : null;
  }

  async findByTypeTag(typeTag: string): Promise<CommunitySnapshot | null> {
    const doc = await this.communityModel.findOne({ typeTag }).lean();
    return doc ? mapCommunityDocumentToSnapshot(doc as CommunitySnapshot) : null;
  }

  async findAllByTypeTag(typeTag: string): Promise<CommunitySnapshot[]> {
    const docs = await this.communityModel.find({ typeTag }).lean();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async insertCommunity(
    community: InsertCommunityInput,
    session?: CommunityPersistenceSession,
  ): Promise<void> {
    await this.communityModel.create(
      [mapCommunitySnapshotToDocument(community)],
      sessionOpts(session),
    );
  }

  async updateCommunity(
    id: string,
    payload: CommunityUpdatePayload,
    session?: CommunityPersistenceSession,
  ): Promise<CommunitySnapshot | null> {
    const update: Record<string, unknown> = { $set: payload.set };
    if (payload.unset && Object.keys(payload.unset).length > 0) {
      update.$unset = payload.unset;
    }
    await this.communityModel.updateOne({ id }, update, sessionOpts(session));
    return this.findById(id, session);
  }

  async resetDailyQuota(id: string, resetAt: Date): Promise<CommunitySnapshot | null> {
    const updated = await this.communityModel
      .findOneAndUpdate(
        { id },
        {
          $set: {
            lastQuotaResetAt: resetAt,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
    return updated ? mapCommunityDocumentToSnapshot(updated as CommunitySnapshot) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.communityModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async addArrayItem(
    id: string,
    field: CommunityArrayField,
    value: string,
  ): Promise<CommunitySnapshot> {
    const updated = await this.communityModel
      .findOneAndUpdate(
        { id },
        {
          $addToSet: { [field]: value },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException('Community not found');
    }
    return mapCommunityDocumentToSnapshot(updated as CommunitySnapshot);
  }

  async removeArrayItem(
    id: string,
    field: CommunityArrayField,
    value: string,
  ): Promise<CommunitySnapshot> {
    const updated = await this.communityModel
      .findOneAndUpdate(
        { id },
        {
          $pull: { [field]: value },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException('Community not found');
    }
    return mapCommunityDocumentToSnapshot(updated as CommunitySnapshot);
  }

  async isUserMember(communityId: string, userId: string): Promise<boolean> {
    const community = await this.communityModel
      .findOne({ id: communityId, members: userId })
      .lean();
    return community !== null;
  }

  async findAll(options: CommunityListOptions): Promise<CommunitySnapshot[]> {
    const filter: Record<string, unknown> = {
      typeTag: { $ne: 'global' },
    };
    if (options.excludeProjects) {
      filter.isProject = { $ne: true };
    }
    const docs = await this.communityModel
      .find(filter)
      .limit(options.limit)
      .skip(options.skip)
      .sort({ isPriority: -1, createdAt: -1 })
      .lean();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async countAll(options?: Pick<CommunityListOptions, 'excludeProjects'>): Promise<number> {
    const filter: Record<string, unknown> = {
      typeTag: { $ne: 'global' },
    };
    if (options?.excludeProjects) {
      filter.isProject = { $ne: true };
    }
    return this.communityModel.countDocuments(filter);
  }

  async findByQuery(options: CommunityQueryListOptions): Promise<CommunitySnapshot[]> {
    const q = { ...options.query, typeTag: { $ne: 'global' } };
    const order = options.sort ?? { createdAt: -1 };
    const docs = await this.communityModel
      .find(q)
      .limit(options.limit)
      .skip(options.skip)
      .sort(order)
      .lean();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async countByQuery(query: Record<string, unknown>): Promise<number> {
    const q = { ...query, typeTag: { $ne: 'global' } };
    return this.communityModel.countDocuments(q);
  }

  async findByMemberUserId(userId: string): Promise<CommunitySnapshot[]> {
    const docs = await this.communityModel
      .find({ members: userId, typeTag: { $ne: 'global' } })
      .sort({ isPriority: -1, createdAt: -1 })
      .lean();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async findByIds(ids: string[]): Promise<CommunitySnapshot[]> {
    if (ids.length === 0) return [];
    const docs = await this.communityModel.find({ id: { $in: ids } }).lean().exec();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async findManagedByIds(ids: string[]): Promise<CommunitySnapshot[]> {
    if (ids.length === 0) return [];
    const docs = await this.communityModel
      .find({ id: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async findProjectsWhereUserInvested(userId: string): Promise<CommunitySnapshot[]> {
    const docs = await this.communityModel
      .find({
        isProject: true,
        projectInvestments: { $elemMatch: { userId } },
      })
      .lean()
      .exec();
    return docs.map((d) => mapCommunityDocumentToSnapshot(d as CommunitySnapshot));
  }

  async updateProjectInvestments(
    projectId: string,
    investments: ProjectInvestmentEntry[],
    session?: CommunityPersistenceSession,
  ): Promise<void> {
    await this.communityModel.updateOne(
      { id: projectId },
      { $set: { projectInvestments: investments, updatedAt: new Date() } },
      sessionOpts(session),
    );
  }

  async updateManyByIds(ids: string[], set: Record<string, unknown>): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const result = await this.communityModel.updateMany(
      { id: { $in: ids } },
      { $set: { ...set, updatedAt: new Date() } },
    );
    return result.modifiedCount ?? 0;
  }
}

export const communityPersistenceProvider = {
  provide: COMMUNITY_PERSISTENCE_PORT,
  useClass: CommunityPersistenceAdapter,
};
