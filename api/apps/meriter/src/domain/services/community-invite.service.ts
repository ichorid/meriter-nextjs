import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { uid } from 'uid';
import {
  isLegacyCommunityInviteJwtToken,
  verifyCommunityInviteToken,
  type VerifiedCommunityInvite,
} from '../../common/helpers/community-invite-jwt';
import {
  CommunityInviteSchemaClass,
  type CommunityInviteDocument,
} from '../models/community-invite/community-invite.schema';
import { CommunityService } from './community.service';

export const COMMUNITY_INVITE_DEFAULT_TTL_DAYS = 90;

export interface CommunityInviteCreateParams {
  communityId: string;
  inviterUserId: string;
  inviterIsAdmin: boolean;
  parentCommunityId?: string;
}

export interface CommunityInvitePreview {
  communityId: string;
  communityName: string;
  isProject: boolean;
}

@Injectable()
export class CommunityInviteService {
  constructor(
    @InjectModel(CommunityInviteSchemaClass.name)
    private readonly communityInviteModel: Model<CommunityInviteDocument>,
    private readonly communityService: CommunityService,
  ) {}

  async createInviteLink(params: CommunityInviteCreateParams): Promise<{ token: string }> {
    const expiresAt = new Date(
      Date.now() + COMMUNITY_INVITE_DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const token = randomBytes(12).toString('base64url');
    await this.communityInviteModel.create({
      id: uid(),
      token,
      communityId: params.communityId,
      parentCommunityId: params.parentCommunityId,
      inviterUserId: params.inviterUserId,
      inviterIsAdmin: params.inviterIsAdmin,
      expiresAt,
    });
    return { token };
  }

  async resolveInviteToken(token: string, jwtSecret: string): Promise<VerifiedCommunityInvite> {
    if (isLegacyCommunityInviteJwtToken(token)) {
      return verifyCommunityInviteToken(token, jwtSecret);
    }

    const doc = await this.communityInviteModel.findOne({ token }).lean();
    if (!doc) {
      throw new Error('Invalid community invite');
    }
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      throw new Error('Invalid community invite');
    }

    return {
      communityId: doc.communityId,
      parentCommunityId: doc.parentCommunityId ?? undefined,
      inviterUserId: doc.inviterUserId,
      inviterIsAdmin: doc.inviterIsAdmin,
    };
  }

  async getInvitePreview(token: string, jwtSecret: string): Promise<CommunityInvitePreview> {
    const invite = await this.resolveInviteToken(token, jwtSecret);
    const community = await this.communityService.getCommunity(invite.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (!this.communityService.isLocalMembershipCommunity(community)) {
      throw new BadRequestException('Invalid invite');
    }
    return {
      communityId: invite.communityId,
      communityName: community.name,
      isProject: community.isProject === true,
    };
  }
}
