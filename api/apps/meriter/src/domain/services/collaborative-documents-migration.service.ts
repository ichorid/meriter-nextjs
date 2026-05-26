import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { GLOBAL_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import {
  COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION,
} from '../common/constants/collaborative-documents.constants';
import { PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP } from '../common/constants/platform-bootstrap.constants';
import {
  CommunitySchemaClass,
  CommunityDocument,
  type CommunitySettings,
} from '../models/community/community.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocumentDocument,
} from '../models/meriter-document/meriter-document.schema';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsDocument,
  PLATFORM_SETTINGS_ID,
} from '../models/platform-settings/platform-settings.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../models/user-community-role/user-community-role.schema';
import { UserSchemaClass, UserDocument } from '../models/user/user.schema';
import { DocumentService } from './document.service';

export interface CollaborativeDocumentsMigrationStats {
  communitiesSettingsPatched: number;
  documentsCreated: number;
  hubObDocumentsRemoved: number;
  skippedNoActor: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * One-time / revision-gated migration: community document settings + bootstrap official documents.
 * Runs automatically on API startup (see `onModuleInit`).
 */
@Injectable()
export class CollaborativeDocumentsMigrationService implements OnModuleInit {
  private readonly logger = new Logger(CollaborativeDocumentsMigrationService.name);

  constructor(
    @InjectModel(PlatformSettingsSchemaClass.name)
    private readonly platformSettingsModel: Model<PlatformSettingsDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(MeriterDocumentSchemaClass.name)
    private readonly documentModel: Model<MeriterDocumentDocument>,
    @InjectModel(UserCommunityRoleSchemaClass.name)
    private readonly userCommunityRoleModel: Model<UserCommunityRoleDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserDocument>,
    private readonly documentService: DocumentService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.MERITER_MANUAL_COLLABORATIVE_DOCUMENTS_MIGRATION === '1') {
      return;
    }
    try {
      const doc = await this.platformSettingsModel
        .findOne({ id: PLATFORM_SETTINGS_ID })
        .select({ collaborativeDocumentsMigrationRevision: 1 })
        .lean()
        .exec();
      const rev = doc?.collaborativeDocumentsMigrationRevision ?? 0;
      if (rev >= COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION) {
        this.logger.log(
          `Collaborative documents migration up to date (revision ${rev}). Runs automatically on every API deploy.`,
        );
        return;
      }
      this.logger.log(
        `Migrating collaborative documents (revision ${rev} → ${COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION})…`,
      );
      const stats = await this.runMigration(false);
      await this.platformSettingsModel.findOneAndUpdate(
        { id: PLATFORM_SETTINGS_ID },
        {
          $set: {
            collaborativeDocumentsMigrationRevision:
              COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            id: PLATFORM_SETTINGS_ID,
            welcomeMeritsGlobal: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.welcomeMeritsGlobal,
            decree809Enabled: PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.decree809Enabled,
            popularValueTagsThreshold:
              PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP.popularValueTagsThreshold,
          },
        },
        { upsert: true },
      );
      this.logger.log(
        `Collaborative documents migration finished: ${JSON.stringify(stats)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Collaborative documents migration failed: ${msg}`);
    }
  }

  async runMigration(dryRun: boolean): Promise<CollaborativeDocumentsMigrationStats> {
    const stats: CollaborativeDocumentsMigrationStats = {
      communitiesSettingsPatched: 0,
      documentsCreated: 0,
      hubObDocumentsRemoved: 0,
      skippedNoActor: 0,
      errors: [],
    };

    const missingDocsSettings = await this.communityModel
      .find({
        id: { $ne: GLOBAL_COMMUNITY_ID },
        typeTag: { $ne: 'global' },
        $or: [
          { 'settings.documentsMode': { $exists: false } },
          { 'settings.documentCreators': { $exists: false } },
          { 'settings.documentVotingDurationHours': { $exists: false } },
          { 'settings.documentDefaultMode': { $exists: false } },
          { 'settings.documentAutoApplyTimerHours': { $exists: false } },
        ],
      })
      .lean()
      .exec();

    for (const community of missingDocsSettings) {
      const id = community.id;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      const s = (community.settings ?? {}) as CommunitySettings;
      if (s.documentsMode === undefined) {
        set['settings.documentsMode'] = 'visionOrDescriptionOnly';
      }
      if (s.documentCreators === undefined) {
        set['settings.documentCreators'] = 'admins';
      }
      if (s.documentVotingDurationHours === undefined) {
        set['settings.documentVotingDurationHours'] = 48;
      }
      if (s.documentDefaultMode === undefined) {
        set['settings.documentDefaultMode'] = 'manual';
      }
      if (s.documentAutoApplyTimerHours === undefined) {
        set['settings.documentAutoApplyTimerHours'] = 48;
      }
      try {
        if (!dryRun) {
          await this.communityModel.updateOne({ id }, { $set: set });
        }
        stats.communitiesSettingsPatched++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
      }
    }

    const hubCommunities = await this.communityModel
      .find({
        typeTag: { $in: ['future-vision', 'marathon-of-good', 'team-projects'] },
      })
      .select({ id: 1 })
      .lean()
      .exec();
    const hubCommunityIds = hubCommunities
      .map((c) => c.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (hubCommunityIds.length > 0) {
      if (!dryRun) {
        const hubModeResult = await this.communityModel.updateMany(
          { id: { $in: hubCommunityIds } },
          {
            $set: {
              'settings.documentsMode': 'off',
              updatedAt: new Date(),
            },
          },
        );
        stats.communitiesSettingsPatched += hubModeResult.modifiedCount ?? 0;

        const result = await this.documentModel.updateMany(
          {
            communityId: { $in: hubCommunityIds },
            type: 'imageOfFuture',
            deleted: false,
          },
          { $set: { deleted: true, updatedAt: new Date() } },
        );
        stats.hubObDocumentsRemoved = result.modifiedCount ?? 0;
      } else {
        const count = await this.documentModel.countDocuments({
          communityId: { $in: hubCommunityIds },
          type: 'imageOfFuture',
          deleted: false,
        });
        stats.hubObDocumentsRemoved = count;
      }
    }

    const candidates = await this.communityModel
      .find({
        id: { $ne: GLOBAL_COMMUNITY_ID },
        typeTag: { $ne: 'global' },
      })
      .lean()
      .exec();

    for (const c of candidates) {
      const communityId = c.id;
      if (!communityId) {
        continue;
      }

      const createdBy = await this.resolveCreatedBy(communityId, c);
      if (!createdBy) {
        stats.skippedNoActor++;
        continue;
      }

      const futureVisionText =
        typeof c.futureVisionText === 'string' ? c.futureVisionText : '';
      const descriptionText = typeof c.description === 'string' ? c.description : '';
      const isProject = c.isProject === true;
      const typeTag = c.typeTag as string | undefined;

      try {
        if (!dryRun) {
          const { documentsCreated } = await this.documentService.bootstrapForNewCommunity({
            communityId,
            typeTag,
            isProject,
            createdByUserId: createdBy,
            futureVisionText,
            description: descriptionText,
          });
          stats.documentsCreated += documentsCreated;
        } else {
          const wouldCreateOb =
            typeTag !== 'future-vision' &&
            typeTag !== 'marathon-of-good' &&
            typeTag !== 'team-projects' &&
            typeTag !== 'global';
          const wouldCreateDescription = isProject;
          const existingOb = wouldCreateOb
            ? await this.documentModel.exists({
                communityId,
                type: 'imageOfFuture',
                deleted: false,
              })
            : true;
          const existingDesc = wouldCreateDescription
            ? await this.documentModel.exists({
                communityId,
                type: 'description',
                deleted: false,
              })
            : true;
          if (wouldCreateOb && !existingOb) {
            stats.documentsCreated += 1;
          }
          if (wouldCreateDescription && !existingDesc) {
            stats.documentsCreated += 1;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: communityId, error: msg });
      }
    }

    return stats;
  }

  private async resolveCreatedBy(
    communityId: string,
    community?: {
      founderUserId?: string;
    },
  ): Promise<string | null> {
    const lead = await this.userCommunityRoleModel
      .findOne({ communityId, role: 'lead' })
      .lean()
      .exec();
    if (lead?.userId) {
      return lead.userId;
    }
    if (community?.founderUserId) {
      return community.founderUserId;
    }
    const any = await this.userCommunityRoleModel.findOne({ communityId }).lean().exec();
    if (any?.userId) {
      return any.userId;
    }
    const superadmin = await this.userModel
      .findOne({ globalRole: GLOBAL_ROLE_SUPERADMIN })
      .select({ id: 1 })
      .lean()
      .exec();
    return superadmin?.id ?? null;
  }
}
