#!/usr/bin/env ts-node

/**
 * Migration §5.1 (collaborative documents): defaults on communities + bootstrap `documents` from legacy fields.
 *
 * - Adds missing document-related settings on communities (idempotent).
 * - Creates official `imageOfFuture` / `description` rows in `documents` when absent,
 *   mirroring plain text into `futureVisionText` / `description` on the community document.
 *
 * Usage:
 *   pnpm exec ts-node scripts/migrate-collaborative-documents.ts [--dry-run]
 *
 * Environment:
 *   MONGO_URL or MONGODB_URI (default mongodb://localhost:27017/meriter)
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { uid } from 'uid';

import { GLOBAL_COMMUNITY_ID } from '../apps/meriter/src/domain/common/constants/global.constant';

dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../.env.local') });

const MONGO_URL =
  process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/meriter';

function concatOfficialPlainText(sections: Array<{ order: number; title?: string; blocks: Array<{ order: number; officialContent?: string }> }>): string {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const chunks: string[] = [];
  for (const sec of sortedSections) {
    const sortedBlocks = [...sec.blocks].sort((a, b) => a.order - b.order);
    const body = sortedBlocks
      .map((b) => (b.officialContent ?? '').trim())
      .filter(Boolean)
      .join('\n\n');
    if (sec.title?.trim()) {
      chunks.push(`\n\n# ${sec.title.trim()}\n\n${body}`);
    } else {
      chunks.push(body);
    }
  }
  return chunks.join('').trim();
}

async function resolveCreatedBy(
  db: ReturnType<MongoClient['db']>,
  communityId: string,
): Promise<string | null> {
  const roles = db.collection('user_community_roles');
  const lead = await roles.findOne({ communityId, role: 'lead' });
  if (lead && typeof lead.userId === 'string') {
    return lead.userId;
  }
  const any = await roles.findOne({ communityId });
  if (any && typeof any.userId === 'string') {
    return any.userId;
  }
  return null;
}

interface MigrationStats {
  communitiesSettingsPatched: number;
  documentsCreated: number;
  skippedNoActor: number;
  errors: Array<{ id: string; error: string }>;
}

async function migrate(dryRun: boolean): Promise<MigrationStats> {
  const client = new MongoClient(MONGO_URL);
  const stats: MigrationStats = {
    communitiesSettingsPatched: 0,
    documentsCreated: 0,
    skippedNoActor: 0,
    errors: [],
  };

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const communities = db.collection('communities');
    const documents = db.collection('documents');

    // 1) Defaults on communities (only when keys missing)
    const missingDocsSettings = await communities
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
      .toArray();

    console.log(`Communities needing document settings defaults: ${missingDocsSettings.length}`);

    for (const doc of missingDocsSettings) {
      const id = doc.id ?? doc._id?.toString?.();
      const set: Record<string, unknown> = { updatedAt: new Date() };
      const s = doc.settings ?? {};
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
          await communities.updateOne({ _id: doc._id }, { $set: set });
        }
        stats.communitiesSettingsPatched++;
        console.log(`[${dryRun ? 'DRY RUN' : 'OK'}] community ${id}: document settings defaults`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ id: id ?? 'unknown', error: msg });
        console.error(`Error patching settings for ${id}:`, msg);
      }
    }

    // 2) Bootstrap documents collection
    const candidates = await communities
      .find({
        id: { $ne: GLOBAL_COMMUNITY_ID },
        typeTag: { $ne: 'global' },
      })
      .toArray();

    console.log(`Communities to check for official documents: ${candidates.length}`);

    for (const c of candidates) {
      const communityId = c.id as string;
      if (!communityId) {
        continue;
      }

      const createdBy = await resolveCreatedBy(db, communityId);
      if (!createdBy) {
        stats.skippedNoActor++;
        console.warn(`[skip] ${communityId}: no user_community_roles row — cannot set createdBy`);
        continue;
      }

      const futureVisionText = typeof c.futureVisionText === 'string' ? c.futureVisionText : '';
      const descriptionText = typeof c.description === 'string' ? c.description : '';
      const isProject = c.isProject === true;

      const ensureDoc = async (
        type: 'imageOfFuture' | 'description',
        title: string,
        initialParagraph: string,
        mirrorField: 'futureVisionText' | 'description',
      ) => {
        const existing = await documents.findOne({
          communityId,
          type,
          deleted: false,
        });
        if (existing) {
          return;
        }

        const settings = c.settings ?? {};
        const postCost = typeof settings.postCost === 'number' ? settings.postCost : 1;
        const variantCostOverride = settings.documentVariantCost;
        const variantCost =
          variantCostOverride === null || variantCostOverride === undefined
            ? postCost
            : variantCostOverride;
        const votingDurationHours =
          typeof settings.documentVotingDurationHours === 'number'
            ? settings.documentVotingDurationHours
            : 48;
        const mode =
          settings.documentDefaultMode === 'auto' || settings.documentDefaultMode === 'manual'
            ? settings.documentDefaultMode
            : 'manual';

        const sectionId = randomUUID();
        const blockId = randomUUID();
        const now = new Date();

        const docPayload = {
          id: uid(),
          communityId,
          type,
          title,
          sections: [
            {
              id: sectionId,
              title: '',
              order: 0,
              blocks: [
                {
                  id: blockId,
                  order: 0,
                  blockType: 'paragraph',
                  officialContent: initialParagraph,
                  officialContentSetAt: now,
                  officialContentSetBy: createdBy,
                  officialContentReason: 'initial',
                  editHistory: [],
                },
              ],
            },
          ],
          mode,
          votingDurationHours,
          variantCost,
          allowDownvotes: true,
          createdBy,
          status: 'active',
          deleted: false,
          createdAt: now,
          updatedAt: now,
        };

        try {
          if (!dryRun) {
            await documents.insertOne(docPayload);
            const plain = concatOfficialPlainText(
              docPayload.sections.map((sec) => ({
                order: sec.order,
                title: sec.title,
                blocks: sec.blocks.map((b) => ({
                  order: b.order,
                  officialContent: b.officialContent,
                })),
              })),
            );
            await communities.updateOne(
              { id: communityId },
              { $set: { [mirrorField]: plain, updatedAt: new Date() } },
            );
          }
          stats.documentsCreated++;
          console.log(
            `[${dryRun ? 'DRY RUN' : 'OK'}] ${communityId}: created document type=${type}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.errors.push({ id: communityId, error: msg });
          console.error(`Error creating ${type} for ${communityId}:`, msg);
        }
      };

      await ensureDoc('imageOfFuture', 'Образ будущего', futureVisionText, 'futureVisionText');
      if (isProject) {
        await ensureDoc('description', 'Описание проекта', descriptionText, 'description');
      }
    }

    console.log('\nMigration summary:');
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await client.close();
  }

  return stats;
}

const dryRun = process.argv.includes('--dry-run');

migrate(dryRun)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
