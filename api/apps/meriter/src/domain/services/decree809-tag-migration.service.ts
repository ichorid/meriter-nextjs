import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DECREE_809_TAGS,
  DECREE_809_TAGS_REVISION,
  remapDecree809ValueTags,
} from '@meriter/shared-types';
import { PUBLIC_PLATFORM_SETTINGS_BOOTSTRAP } from '../common/constants/platform-bootstrap.constants';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsDocument,
  PLATFORM_SETTINGS_ID,
} from '../models/platform-settings/platform-settings.schema';

/**
 * One-time migration: sync Mongo `decree809Tags` to canonical `DECREE_809_TAGS` and
 * remap legacy value-tag strings on communities / publications (no wipe).
 */
@Injectable()
export class Decree809TagMigrationService implements OnModuleInit {
  private readonly logger = new Logger(Decree809TagMigrationService.name);

  constructor(
    @InjectModel(PlatformSettingsSchemaClass.name)
    private readonly platformSettingsModel: Model<PlatformSettingsDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const doc = await this.platformSettingsModel
        .findOne({ id: PLATFORM_SETTINGS_ID })
        .select({ decree809TagsRevision: 1 })
        .lean()
        .exec();
      const rev = doc?.decree809TagsRevision ?? 0;
      if (rev >= DECREE_809_TAGS_REVISION) {
        return;
      }
      this.logger.log(
        `Migrating Decree 809 tags (revision ${rev} → ${DECREE_809_TAGS_REVISION})…`,
      );
      await this.runMigration();
      this.logger.log('Decree 809 tag migration finished.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Decree 809 tag migration failed: ${msg}`);
    }
  }

  private async runMigration(): Promise<void> {
    let communities = 0;
    const commCursor = this.communityModel
      .find({
        $or: [
          { futureVisionTags: { $exists: true, $ne: [] } },
          { 'tappalkaSettings.categories': { $exists: true, $ne: [] } },
        ],
      })
      .select({ _id: 1, futureVisionTags: 1, tappalkaSettings: 1 })
      .cursor();

    for await (const c of commCursor) {
      const fv = c.futureVisionTags;
      const cat = c.tappalkaSettings?.categories;
      const nextFv = fv?.length ? remapDecree809ValueTags(fv) : fv;
      const nextCat = cat?.length ? remapDecree809ValueTags(cat) : cat;
      const fvChanged =
        Array.isArray(fv) &&
        fv.length > 0 &&
        JSON.stringify(nextFv) !== JSON.stringify(fv);
      const catChanged =
        Array.isArray(cat) &&
        cat.length > 0 &&
        JSON.stringify(nextCat) !== JSON.stringify(cat);
      if (fvChanged || catChanged) {
        await this.communityModel.updateOne(
          { _id: c._id },
          {
            $set: {
              ...(fvChanged ? { futureVisionTags: nextFv } : {}),
              ...(catChanged ? { 'tappalkaSettings.categories': nextCat } : {}),
            },
          },
        );
        communities += 1;
      }
    }

    let publications = 0;
    const pubCursor = this.publicationModel
      .find({
        $or: [
          { valueTags: { $exists: true, $ne: [] } },
          { categories: { $exists: true, $ne: [] } },
        ],
      })
      .select({ _id: 1, valueTags: 1, categories: 1 })
      .cursor();

    for await (const p of pubCursor) {
      const vt = p.valueTags;
      const cat = p.categories;
      const nextVt = vt?.length ? remapDecree809ValueTags(vt) : vt;
      const nextCat = cat?.length ? remapDecree809ValueTags(cat) : cat;
      const vtChanged =
        Array.isArray(vt) &&
        vt.length > 0 &&
        JSON.stringify(nextVt) !== JSON.stringify(vt);
      const catChanged =
        Array.isArray(cat) &&
        cat.length > 0 &&
        JSON.stringify(nextCat) !== JSON.stringify(cat);
      if (vtChanged || catChanged) {
        await this.publicationModel.updateOne(
          { _id: p._id },
          {
            $set: {
              ...(vtChanged ? { valueTags: nextVt } : {}),
              ...(catChanged ? { categories: nextCat } : {}),
            },
          },
        );
        publications += 1;
      }
    }

    const ps = await this.platformSettingsModel
      .findOne({ id: PLATFORM_SETTINGS_ID })
      .lean()
      .exec();
    const extrasRaw = ps?.availableFutureVisionTags ?? [];
    const extrasNext = remapDecree809ValueTags(extrasRaw);

    await this.platformSettingsModel.findOneAndUpdate(
      { id: PLATFORM_SETTINGS_ID },
      {
        $set: {
          decree809Tags: [...DECREE_809_TAGS],
          decree809TagsRevision: DECREE_809_TAGS_REVISION,
          availableFutureVisionTags: extrasNext,
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
      `Decree 809 migration: updated platform_settings; touched ${communities} communities, ${publications} publications`,
    );
  }
}
