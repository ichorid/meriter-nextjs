import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { UserService } from './user.service';
import { PlatformSettingsService } from './platform-settings.service';
import { CommunityService } from './community.service';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';

const PRIORITY_HUB_TAGS = [
  'future-vision',
  'marathon-of-good',
  'team-projects',
  'support',
] as const;

/**
 * Superadmin-only destructive reset: removes all users except superadmins, all communities
 * except the global merit hub and the four priority hubs, and all related domain data.
 *
 * Preserves: categories, about_* collections. Resets platform_settings and priority hubs to code bootstrap.
 *
 * NOT gated by environment — a mistaken call on production destroys data. UI must warn loudly.
 * Optional future hard-stop: MERITER_DISABLE_PLATFORM_WIPE (not implemented yet).
 */
@Injectable()
export class PlatformWipeService {
  private readonly logger = new Logger(PlatformWipeService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly userService: UserService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly communityService: CommunityService,
  ) {}

  async wipeUserContentAndLocalData(): Promise<{ superadminCount: number }> {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection has no database handle');
    }

    this.logger.warn('Platform wipe started');

    const wipeCollection = async (name: string): Promise<void> => {
      try {
        const r = await db.collection(name).deleteMany({});
        this.logger.log(`Wiped ${name}: deleted ${r.deletedCount}`);
      } catch (e) {
        this.logger.warn(
          `Optional collection ${name} not cleared: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    const ordered = [
      'notifications',
      'favorites',
      'votes',
      'comments',
      'poll_casts',
      'polls',
      'publications',
      'team_invitations',
      'team_join_requests',
      'tappalka_progress',
      'quota_usage',
      'transactions',
      'wallets',
      'community_wallets',
      'user_community_roles',
      'user_settings',
      'passkey_challenges',
    ];

    for (const c of ordered) {
      await wipeCollection(c);
    }

    await wipeCollection('emailotps');
    await wipeCollection('smsotps');
    await wipeCollection('authmagiclinks');
    await wipeCollection('updatesconductorschemaclasses');

    const hubDocs = await db
      .collection('communities')
      .find({
        typeTag: { $in: [...PRIORITY_HUB_TAGS] },
      })
      .project({ id: 1 })
      .toArray();

    const protectedIds = new Set<string>();
    protectedIds.add(GLOBAL_COMMUNITY_ID);
    for (const d of hubDocs) {
      const id = (d as { id?: string }).id;
      if (typeof id === 'string') {
        protectedIds.add(id);
      }
    }

    const commDelete = await db.collection('communities').deleteMany({
      id: { $nin: [...protectedIds] },
    });
    this.logger.log(`Deleted non-protected communities: ${commDelete.deletedCount}`);

    const userDelete = await db.collection('users').deleteMany({
      globalRole: { $ne: 'superadmin' },
    });
    this.logger.log(`Deleted non-superadmin users: ${userDelete.deletedCount}`);

    const superadmins = await db
      .collection('users')
      .find({ globalRole: 'superadmin' })
      .project({ id: 1 })
      .toArray();
    const superadminIds = superadmins
      .map((u) => (u as { id?: string }).id)
      .filter((id): id is string => typeof id === 'string');

    if (superadminIds.length === 0) {
      this.logger.error('Platform wipe finished with zero superadmin users left');
    }

    await db.collection('communities').updateMany(
      { id: { $in: [...protectedIds] } },
      { $set: { members: superadminIds, updatedAt: new Date() } },
    );

    await db.collection('users').updateMany(
      { globalRole: 'superadmin' },
      {
        $set: {
          communityMemberships: [],
          communityTags: [],
          updatedAt: new Date(),
        },
      },
    );

    await this.communityService.resetPriorityCommunitiesAfterPlatformWipe();
    await this.platformSettingsService.resetAfterPlatformWipe();

    for (const id of superadminIds) {
      await this.userService.ensureUserInBaseCommunities(id);
    }

    this.logger.warn('Platform wipe completed');
    return { superadminCount: superadminIds.length };
  }
}
