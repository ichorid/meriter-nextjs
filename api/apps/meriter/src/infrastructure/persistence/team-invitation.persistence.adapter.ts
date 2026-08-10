import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TeamInvitationSchemaClass,
  TeamInvitationDocument,
} from '../../domain/models/team-invitation/team-invitation.schema';
import {
  TEAM_INVITATION_PERSISTENCE_PORT,
  type TeamInvitationPersistencePort,
  type TeamInvitationRecord,
  type TeamInvitationMutableRecord,
} from '../../domain/ports/team-invitation.persistence.port';

function toRecord(
  doc: TeamInvitationDocument | Record<string, unknown>,
): TeamInvitationRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return row as TeamInvitationRecord;
}

@Injectable()
export class TeamInvitationPersistenceAdapter
  implements TeamInvitationPersistencePort
{
  constructor(
    @InjectModel(TeamInvitationSchemaClass.name)
    private readonly teamInvitationModel: Model<TeamInvitationDocument>,
  ) {}

  async create(input: Record<string, unknown>): Promise<TeamInvitationRecord> {
    const doc = await this.teamInvitationModel.create(input);
    return toRecord(doc);
  }

  async findById(
    invitationId: string,
  ): Promise<TeamInvitationMutableRecord | null> {
    const doc = await this.teamInvitationModel.findOne({ id: invitationId }).exec();
    return doc ? (doc as unknown as TeamInvitationMutableRecord) : null;
  }

  async findPendingByTargetAndCommunity(
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationRecord | null> {
    const row = await this.teamInvitationModel
      .findOne({ targetUserId, communityId, status: 'pending' })
      .lean()
      .exec();
    return row ? (row as TeamInvitationRecord) : null;
  }

  async findPendingByInviterTargetCommunity(
    inviterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<TeamInvitationRecord | null> {
    const row = await this.teamInvitationModel
      .findOne({ inviterId, targetUserId, communityId, status: 'pending' })
      .lean()
      .exec();
    return row ? (row as TeamInvitationRecord) : null;
  }

  async listPendingForTarget(targetUserId: string): Promise<TeamInvitationRecord[]> {
    const rows = await this.teamInvitationModel
      .find({ targetUserId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows as TeamInvitationRecord[];
  }
}

export const teamInvitationPersistenceProvider = {
  provide: TEAM_INVITATION_PERSISTENCE_PORT,
  useClass: TeamInvitationPersistenceAdapter,
};
