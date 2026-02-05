import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { CommunitySchemaClass, CommunityDocument } from '../models/community/community.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../models/user-community-role/user-community-role.schema';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { NotificationService, CreateNotificationDto } from './notification.service';
import { PermissionService } from './permission.service';
// Note: COMMUNITY_ROLE_VIEWER removed - all users are now participants

interface QuotaInfo {
  dailyQuota: number;
  usedToday: number;
  remainingToday: number;
}

@Injectable()
export class QuotaResetService {
  private readonly logger = new Logger(QuotaResetService.name);

  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(UserCommunityRoleSchemaClass.name)
    private readonly userCommunityRoleModel: Model<UserCommunityRoleDocument>,
    @InjectConnection() private readonly mongoose: Connection,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly notificationService: NotificationService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Get all user IDs in a community
   */
  private async getUsersInCommunity(communityId: string): Promise<string[]> {
    const roles = await this.userCommunityRoleModel
      .find({ communityId })
      .distinct('userId')
      .exec();
    return roles;
  }

  /**
   * Calculate user quota for a specific community
   * Reuses logic from WalletsController.getUserQuota()
   */
  private async calculateUserQuota(
    userId: string,
    communityId: string,
  ): Promise<QuotaInfo | null> {
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean();

    if (!community) {
      return null;
    }

    // Check if quota is enabled in community settings
    if (community?.meritSettings?.quotaEnabled === false) {
      return {
        dailyQuota: 0,
        usedToday: 0,
        remainingToday: 0,
      };
    }

    // Check if community has quota configured
    if (!community.settings?.dailyEmission || typeof community.settings.dailyEmission !== 'number') {
      return null;
    }

    const dailyQuota = community.settings.dailyEmission;

    // Check user role
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );

    // Future Vision communities don't use quota regardless of role
    // Note: viewer role removed - all users are now participants
    if (community.typeTag === 'future-vision') {
      return {
        dailyQuota: 0,
        usedToday: 0,
        remainingToday: 0,
      };
    }

    // Determine the start time for quota calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;

    // Query votes and poll casts with amountQuota > 0 for this user in this community created after quotaStartTime
    const [votesUsed, pollCastsUsed] = await Promise.all([
      this.mongoose.db!
        .collection('votes')
        .aggregate([
          {
            $match: {
              userId,
              communityId: community.id,
              amountQuota: { $gt: 0 },
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $project: {
              absAmount: '$amountQuota',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$absAmount' },
            },
          },
        ])
        .toArray(),
      this.mongoose.db!
        .collection('poll_casts')
        .aggregate([
          {
            $match: {
              userId,
              communityId: community.id,
              amountQuota: { $gt: 0 },
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $project: {
              absAmount: '$amountQuota',
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$absAmount' },
            },
          },
        ])
        .toArray(),
    ]);

    const votesTotal = votesUsed.length > 0 ? votesUsed[0].total : 0;
    const pollCastsTotal = pollCastsUsed.length > 0 ? pollCastsUsed[0].total : 0;
    const used = votesTotal + pollCastsTotal;

    return {
      dailyQuota,
      usedToday: used,
      remainingToday: Math.max(0, dailyQuota - used),
    };
  }

  /**
   * Check if notification should be created (quota changed)
   */
  private shouldCreateNotification(before: QuotaInfo | null, after: QuotaInfo | null): boolean {
    if (!before || !after) {
      return false;
    }
    // Notification should be created if remaining quota changed
    return before.remainingToday !== after.remainingToday;
  }

  /**
   * Reset quota for a specific community and create notifications for affected users
   */
  async resetQuotaForCommunity(communityId: string): Promise<{ resetAt: Date; notificationsCreated: number }> {
    this.logger.log(`Resetting quota for community ${communityId}`);

    // Get community to check if it exists and has quota configured
    const community = await this.communityModel.findOne({ id: communityId }).lean();
    if (!community) {
      throw new Error(`Community ${communityId} not found`);
    }

    if (!community.settings?.dailyEmission || typeof community.settings.dailyEmission !== 'number') {
      this.logger.log(`Community ${communityId} does not have quota configured, skipping`);
      return { resetAt: new Date(), notificationsCreated: 0 };
    }

    // Get all users in the community
    const userIds = await this.getUsersInCommunity(communityId);
    this.logger.log(`Found ${userIds.length} users in community ${communityId}`);

    // Calculate quota before reset for each user
    const quotaBeforeMap = new Map<string, QuotaInfo | null>();
    for (const userId of userIds) {
      const quotaBefore = await this.calculateUserQuota(userId, communityId);
      quotaBeforeMap.set(userId, quotaBefore);
    }

    // Perform the reset
    const { resetAt } = await this.communityService.resetDailyQuota(communityId);

    // Calculate quota after reset for each user
    const quotaAfterMap = new Map<string, QuotaInfo | null>();
    for (const userId of userIds) {
      const quotaAfter = await this.calculateUserQuota(userId, communityId);
      quotaAfterMap.set(userId, quotaAfter);
    }

    // Create notifications for users whose quota changed
    let notificationsCreated = 0;
    for (const userId of userIds) {
      const quotaBefore = quotaBeforeMap.get(userId) ?? null;
      const quotaAfter = quotaAfterMap.get(userId) ?? null;

      if (this.shouldCreateNotification(quotaBefore, quotaAfter)) {
        const amountBefore = quotaBefore?.remainingToday ?? 0;
        const amountAfter = quotaAfter?.remainingToday ?? 0;

        const notificationDto: CreateNotificationDto = {
          userId,
          type: 'quota',
          source: 'system',
          sourceId: communityId,
          metadata: {
            communityId,
            amountBefore,
            amountAfter,
          },
          title: 'Daily quota reset',
          message: `Your daily quota has been reset. You now have ${amountAfter} votes available.`,
        };

        await this.notificationService.createNotification(notificationDto);
        notificationsCreated++;
        this.logger.log(
          `Created quota reset notification for user ${userId} in community ${communityId} (${amountBefore} -> ${amountAfter})`,
        );
      }
    }

    this.logger.log(
      `Quota reset completed for community ${communityId}. Created ${notificationsCreated} notifications.`,
    );

    return { resetAt, notificationsCreated };
  }

  /**
   * Reset quota for all communities
   */
  async resetAllCommunitiesQuota(): Promise<{ totalReset: number; totalNotifications: number }> {
    this.logger.log('Starting quota reset for all communities');

    const communities = await this.communityModel.find({}).lean();
    this.logger.log(`Found ${communities.length} communities`);

    let totalReset = 0;
    let totalNotifications = 0;

    for (const community of communities) {
      try {
        const { notificationsCreated } = await this.resetQuotaForCommunity(community.id);
        totalReset++;
        totalNotifications += notificationsCreated;
      } catch (error) {
        this.logger.error(
          `Failed to reset quota for community ${community.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Quota reset completed for all communities. Reset ${totalReset} communities, created ${totalNotifications} notifications.`,
    );

    return { totalReset, totalNotifications };
  }

  /**
   * Cron job to reset all communities' quota at midnight UTC
   */
  @Cron('0 0 * * *')
  async resetAllCommunitiesQuotaAtMidnight(): Promise<void> {
    this.logger.log('Midnight quota reset cron job triggered');
    await this.resetAllCommunitiesQuota();
  }
}

