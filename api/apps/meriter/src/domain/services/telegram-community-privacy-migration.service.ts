import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';

const TELEGRAM_PRIVACY_MIGRATION_REVISION = 1;

/**
 * One-time migration: mark existing Telegram-linked communities as platform-integrated private
 * so they stop appearing in the public Future Visions feed until explicitly made public.
 */
@Injectable()
export class TelegramCommunityPrivacyMigrationService implements OnModuleInit {
  private readonly logger = new Logger(TelegramCommunityPrivacyMigrationService.name);

  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.runIfNeeded();
    } catch (error) {
      this.logger.error(
        `Telegram privacy migration failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async runIfNeeded(): Promise<{ patched: number }> {
    const communities = await this.communityModel
      .find({ telegramChatId: { $exists: true, $ne: null } })
      .lean();
    let patched = 0;

    for (const community of communities) {
      const settings = (community.settings ?? {}) as Record<string, unknown>;
      if (settings.telegramPlatformIntegration !== undefined) {
        continue;
      }

      const hasFutureVision = Boolean(
        typeof community.futureVisionText === 'string' && community.futureVisionText.trim(),
      );
      await this.communityModel.updateOne(
        { id: community.id },
        {
          $set: {
            'settings.telegramPlatformIntegration': hasFutureVision,
            'settings.telegramPlatformVisibility': 'private',
            updatedAt: new Date(),
          },
        },
      );
      patched += 1;
    }

    if (patched > 0) {
      this.logger.log(
        `Telegram privacy migration r${TELEGRAM_PRIVACY_MIGRATION_REVISION}: patched ${patched} communities`,
      );
    }

    return { patched };
  }
}
