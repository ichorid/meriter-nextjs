import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TeamJoinRequestSchemaClass,
  TeamJoinRequestDocument,
} from '../../domain/models/team-join-request/team-join-request.schema';
import {
  TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
  type TeamJoinRequestPersistencePort,
  type TeamJoinRequestRecord,
  type TeamJoinRequestMutableRecord,
} from '../../domain/ports/team-join-request.persistence.port';

function toRecord(
  doc: TeamJoinRequestDocument | Record<string, unknown>,
): TeamJoinRequestRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return row as TeamJoinRequestRecord;
}

@Injectable()
export class TeamJoinRequestPersistenceAdapter
  implements TeamJoinRequestPersistencePort
{
  constructor(
    @InjectModel(TeamJoinRequestSchemaClass.name)
    private readonly teamJoinRequestModel: Model<TeamJoinRequestDocument>,
  ) {}

  async create(input: Record<string, unknown>): Promise<TeamJoinRequestRecord> {
    const doc = await this.teamJoinRequestModel.create(input);
    return toRecord(doc);
  }

  async findById(requestId: string): Promise<TeamJoinRequestMutableRecord | null> {
    const doc = await this.teamJoinRequestModel.findOne({ id: requestId }).exec();
    return doc ? (doc as unknown as TeamJoinRequestMutableRecord) : null;
  }

  async findPendingByUserAndCommunity(
    userId: string,
    communityId: string,
  ): Promise<TeamJoinRequestRecord | null> {
    const row = await this.teamJoinRequestModel
      .findOne({ userId, communityId, status: 'pending' })
      .lean()
      .exec();
    return row ? (row as TeamJoinRequestRecord) : null;
  }

  async listPendingByCommunity(communityId: string): Promise<TeamJoinRequestRecord[]> {
    const rows = await this.teamJoinRequestModel
      .find({ communityId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as TeamJoinRequestRecord[];
  }

  async listByUser(userId: string): Promise<TeamJoinRequestRecord[]> {
    const rows = await this.teamJoinRequestModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as TeamJoinRequestRecord[];
  }

  async deleteById(requestId: string): Promise<void> {
    await this.teamJoinRequestModel.deleteOne({ id: requestId }).exec();
  }
}

export const teamJoinRequestPersistenceProvider = {
  provide: TEAM_JOIN_REQUEST_PERSISTENCE_PORT,
  useClass: TeamJoinRequestPersistenceAdapter,
};
