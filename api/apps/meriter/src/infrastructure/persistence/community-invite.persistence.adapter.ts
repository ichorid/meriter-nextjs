import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommunityInviteSchemaClass,
  CommunityInviteDocument,
} from '../../domain/models/community-invite/community-invite.schema';
import {
  COMMUNITY_INVITE_PERSISTENCE_PORT,
  type CommunityInvitePersistencePort,
  type CommunityInviteRecord,
  type CreateCommunityInviteInput,
} from '../../domain/ports/community-invite.persistence.port';

@Injectable()
export class CommunityInvitePersistenceAdapter implements CommunityInvitePersistencePort {
  constructor(
    @InjectModel(CommunityInviteSchemaClass.name)
    private readonly communityInviteModel: Model<CommunityInviteDocument>,
  ) {}

  async create(input: CreateCommunityInviteInput): Promise<void> {
    await this.communityInviteModel.create(input);
  }

  async findByToken(token: string): Promise<CommunityInviteRecord | null> {
    const doc = await this.communityInviteModel.findOne({ token }).lean().exec();
    return doc ? (doc as CommunityInviteRecord) : null;
  }
}

export const communityInvitePersistenceProvider = {
  provide: COMMUNITY_INVITE_PERSISTENCE_PORT,
  useClass: CommunityInvitePersistenceAdapter,
};
