import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../domain/models/user-community-role/user-community-role.schema';

/**
 * Migration script to convert all 'viewer' roles to 'participant'
 * 
 * This migration is part of the role system refactoring to remove the 'viewer' role
 * and make all users full participants by default.
 * 
 * IMPORTANT: This migration is irreversible - once viewers become participants,
 * there's no way to distinguish former viewers from original participants.
 * 
 * Usage:
 * 1. Make a backup of the database before running
 * 2. Run this migration on dev/staging first
 * 3. Verify the results
 * 4. Run on production
 */
@Injectable()
export class MigrateViewersToParticipantsService {
  private readonly logger = new Logger(MigrateViewersToParticipantsService.name);

  constructor(
    @InjectModel(UserCommunityRoleSchemaClass.name)
    private readonly userCommunityRoleModel: Model<UserCommunityRoleDocument>,
  ) {}

  /**
   * Execute the migration
   * @returns Object with migration statistics
   */
  async migrate(): Promise<{ updated: number; totalViewers: number }> {
    this.logger.log('Starting migration: viewer → participant');

    // Count viewers before migration
    const totalViewers = await this.userCommunityRoleModel.countDocuments({
      role: 'viewer',
    });
    this.logger.log(`Found ${totalViewers} viewer records to migrate`);

    if (totalViewers === 0) {
      this.logger.log('No viewers found. Migration not needed.');
      return { updated: 0, totalViewers: 0 };
    }

    // Perform the migration
    const result = await this.userCommunityRoleModel.updateMany(
      { role: 'viewer' },
      { $set: { role: 'participant' } },
    );

    this.logger.log(
      `Migration complete. Updated ${result.modifiedCount} records`,
    );

    // Verify migration
    const remainingViewers = await this.userCommunityRoleModel.countDocuments({
      role: 'viewer',
    });

    if (remainingViewers > 0) {
      this.logger.error(
        `WARNING: Migration incomplete. ${remainingViewers} viewer records still exist.`,
      );
      throw new Error(
        `Migration incomplete. ${remainingViewers} viewer records still exist.`,
      );
    }

    this.logger.log('Verification passed. No viewers remaining.');

    return {
      updated: result.modifiedCount,
      totalViewers,
    };
  }

  /**
   * Rollback is not recommended and not implemented
   * Once viewers become participants, we cannot distinguish them
   */
  async rollback(): Promise<void> {
    this.logger.warn(
      'Rollback not recommended for this migration. Cannot distinguish former viewers from original participants.',
    );
    throw new Error(
      'Rollback not supported for viewer→participant migration',
    );
  }
}

