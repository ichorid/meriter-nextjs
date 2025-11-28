import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invite, InviteDocument } from '../models/invite/invite.schema';
import { uid } from 'uid';

/**
 * InviteService
 *
 * Service for managing invites to communities and teams.
 * Invites are one-time use and tied to a specific user.
 */
@Injectable()
export class InviteService {
  constructor(
    @InjectModel(Invite.name)
    private inviteModel: Model<InviteDocument>,
  ) {}

  /**
   * Create a new invite
   */
  async createInvite(
    createdBy: string,
    targetUserId: string,
    type: 'superadmin-to-lead' | 'lead-to-participant',
    communityId: string,
    teamId?: string,
    expiresAt?: Date,
  ): Promise<Invite> {
    // Generate unique code
    const code = uid(16);

    const invite = new this.inviteModel({
      id: uid(32),
      code,
      type,
      createdBy,
      targetUserId,
      communityId,
      teamId,
      expiresAt,
      isUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return invite.save();
  }

  /**
   * Get invite by code
   */
  async getInviteByCode(code: string): Promise<InviteDocument | null> {
    return this.inviteModel.findOne({ code }).exec();
  }

  /**
   * Get invite by ID
   */
  async getInviteById(id: string): Promise<Invite | null> {
    return this.inviteModel.findOne({ id }).exec();
  }

  /**
   * Get all invites created by a user
   */
  async getInvitesByCreator(createdBy: string): Promise<Invite[]> {
    return this.inviteModel.find({ createdBy }).exec();
  }

  /**
   * Get all invites for a user (targetUserId)
   */
  async getInvitesForUser(targetUserId: string): Promise<Invite[]> {
    return this.inviteModel.find({ targetUserId }).exec();
  }

  /**
   * Use an invite (mark as used)
   */
  async useInvite(code: string, userId: string): Promise<InviteDocument> {
    const invite = await this.getInviteByCode(code);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.isUsed) {
      throw new BadRequestException('Invite already used');
    }

    // Check if invite is for this user
    if (invite.targetUserId !== userId) {
      throw new BadRequestException('This invite is not for you');
    }

    // Check expiration
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired');
    }

    invite.isUsed = true;
    invite.usedBy = userId;
    invite.usedAt = new Date();
    invite.updatedAt = new Date();

    return invite.save();
  }

  /**
   * Delete an invite
   */
  async deleteInvite(id: string): Promise<void> {
    await this.inviteModel.deleteOne({ id }).exec();
  }
}
