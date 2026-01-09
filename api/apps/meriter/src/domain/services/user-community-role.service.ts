import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../models/user-community-role/user-community-role.schema';
import type { UserCommunityRole } from '../models/user-community-role/user-community-role.schema';
import { CommunityService } from './community.service';
import { COMMUNITY_ROLE_LEAD } from '../common/constants/roles.constants';
import { uid } from 'uid';

/**
 * UserCommunityRoleService
 *
 * Service for managing user roles within communities.
 * Handles CRUD operations for UserCommunityRole model.
 */
@Injectable()
export class UserCommunityRoleService {
  private readonly logger = new Logger(UserCommunityRoleService.name);

  constructor(
    @InjectModel(UserCommunityRoleSchemaClass.name)
    private userCommunityRoleModel: Model<UserCommunityRoleDocument>,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
  ) {}

  /**
   * Get user role in a specific community
   */
  async getRole(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityRoleDocument | null> {
    const doc = await this.userCommunityRoleModel
      .findOne({
        userId,
        communityId,
      })
      .lean()
      .exec();
    // Convert lean document to Mongoose document for compatibility
    if (!doc) {
      return null;
    }
    // Return as UserCommunityRoleDocument (the interface allows this)
    return doc as unknown as UserCommunityRoleDocument;
  }

  /**
   * Get all roles for a user across all communities
   */
  async getUserRoles(userId: string): Promise<UserCommunityRole[]> {
    return this.userCommunityRoleModel.find({ userId }).exec();
  }

  /**
   * Get all users with a specific role in a community
   */
  async getUsersByRole(
    communityId: string,
    role: 'lead' | 'participant' | 'viewer',
  ): Promise<UserCommunityRole[]> {
    return this.userCommunityRoleModel
      .find({
        communityId,
        role,
      })
      .exec();
  }

  /**
   * Get the paired community typeTag for marathon-of-good and future-vision
   * Returns null if the community is not one of these special communities
   */
  private getPairedCommunityTypeTag(
    typeTag: string | undefined,
  ): string | null {
    if (typeTag === 'marathon-of-good') {
      return 'future-vision';
    }
    if (typeTag === 'future-vision') {
      return 'marathon-of-good';
    }
    return null;
  }

  /**
   * Create or update user role in a community
   * Synchronizes lead status between marathon-of-good and future-vision communities
   */
  async setRole(
    userId: string,
    communityId: string,
    role: 'lead' | 'participant' | 'viewer',
    skipSync: boolean = false, // Recursion guard to prevent infinite loops
  ): Promise<UserCommunityRoleDocument> {
    // Get existing role (without lean to check if it exists)
    const existingDoc = await this.userCommunityRoleModel
      .findOne({
        userId,
        communityId,
      })
      .exec();
    const previousRole = existingDoc?.role;

    // Update or create the role
    let result: UserCommunityRoleDocument;
    if (existingDoc) {
      existingDoc.role = role;
      existingDoc.updatedAt = new Date();
      result = await existingDoc.save();
    } else {
      const newRole = new this.userCommunityRoleModel({
        id: uid(32),
        userId,
        communityId,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      result = await newRole.save();
    }

    // Synchronize lead status between marathon-of-good and future-vision
    if (!skipSync) {
      const community = await this.communityService.getCommunity(communityId);
      if (community?.typeTag) {
        const pairedTypeTag = this.getPairedCommunityTypeTag(community.typeTag);
        if (pairedTypeTag) {
          const pairedCommunity =
            await this.communityService.getCommunityByTypeTag(pairedTypeTag);
          if (pairedCommunity) {
            // Only sync 'lead' role changes
            if (role === COMMUNITY_ROLE_LEAD) {
              // User is becoming lead - set lead in paired community
              this.logger.log(
                `Syncing lead status: User ${userId} is now lead in ${community.typeTag}, setting lead in ${pairedTypeTag}`,
              );
              await this.setRole(
                userId,
                pairedCommunity.id,
                'lead',
                true, // Skip sync to prevent recursion
              );
            } else if (previousRole === COMMUNITY_ROLE_LEAD) {
              // User was lead and is now changing to another role - sync the change
              this.logger.log(
                `Syncing role change: User ${userId} changed from lead to ${role} in ${community.typeTag}, updating ${pairedTypeTag}`,
              );
              await this.setRole(
                userId,
                pairedCommunity.id,
                role,
                true, // Skip sync to prevent recursion
              );
            }
            // If previousRole was not 'lead' and new role is not 'lead', no sync needed
          } else {
            this.logger.warn(
              `Paired community with typeTag ${pairedTypeTag} not found, skipping sync`,
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Remove user role from a community
   */
  async removeRole(userId: string, communityId: string): Promise<void> {
    await this.userCommunityRoleModel
      .deleteOne({
        userId,
        communityId,
      })
      .exec();
  }

  /**
   * Check if user has a specific role in a community
   */
  async hasRole(
    userId: string,
    communityId: string,
    role: 'lead' | 'participant' | 'viewer',
  ): Promise<boolean> {
    const userRole = await this.getRole(userId, communityId);
    return userRole?.role === role;
  }

  /**
   * Get all communities where user has a specific role
   */
  async getCommunitiesByRole(
    userId: string,
    role: 'lead' | 'participant' | 'viewer',
  ): Promise<string[]> {
    const roles = await this.userCommunityRoleModel
      .find({
        userId,
        role,
      })
      .exec();

    return roles.map((r) => r.communityId);
  }

  /**
   * Get all users with a specific role across all communities
   * Returns unique user IDs that have the specified role in at least one community
   */
  async getAllUsersByRole(
    role: 'lead' | 'participant' | 'viewer',
  ): Promise<string[]> {
    const userIds = await this.userCommunityRoleModel
      .distinct('userId', {
        role,
      })
      .exec();

    return userIds;
  }
}
