import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserCommunityRole,
  UserCommunityRoleDocument,
} from '../models/user-community-role/user-community-role.schema';
import { uid } from 'uid';

/**
 * UserCommunityRoleService
 *
 * Service for managing user roles within communities.
 * Handles CRUD operations for UserCommunityRole model.
 */
@Injectable()
export class UserCommunityRoleService {
  constructor(
    @InjectModel(UserCommunityRole.name)
    private userCommunityRoleModel: Model<UserCommunityRoleDocument>,
  ) {}

  /**
   * Get user role in a specific community
   */
  async getRole(
    userId: string,
    communityId: string,
  ): Promise<UserCommunityRoleDocument | null> {
    return this.userCommunityRoleModel
      .findOne({
        userId,
        communityId,
      })
      .exec();
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
   * Create or update user role in a community
   */
  async setRole(
    userId: string,
    communityId: string,
    role: 'lead' | 'participant' | 'viewer',
  ): Promise<UserCommunityRoleDocument> {
    const existing = await this.getRole(userId, communityId);

    if (existing) {
      existing.role = role;
      existing.updatedAt = new Date();
      return existing.save();
    }

    const newRole = new this.userCommunityRoleModel({
      id: uid(32),
      userId,
      communityId,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newRole.save();
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
}
