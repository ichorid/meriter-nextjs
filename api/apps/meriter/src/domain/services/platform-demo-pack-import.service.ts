import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { z } from 'zod';
import { ENTREPRENEURS_DEMO_COMMUNITY_ID } from '../common/constants/entrepreneurs-demo.constants';

export const MERITER_DEMO_PACK_V1 = 1 as const;

const MeriterDemoPackV1Schema = z.object({
  version: z.literal(MERITER_DEMO_PACK_V1),
  packId: z.literal('entrepreneurs'),
  collections: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

export type MeriterDemoPackV1 = z.infer<typeof MeriterDemoPackV1Schema>;

const FORBIDDEN_COLLECTIONS = new Set([
  'platform_settings',
  'about',
  'categories',
  'priority_hubs',
]);

const DEMO_ENT_PREFIX = 'demo_ent_';

function isAllowedDemoDocument(
  collection: string,
  doc: Record<string, unknown>,
): boolean {
  const id = typeof doc.id === 'string' ? doc.id : '';
  if (id.startsWith(DEMO_ENT_PREFIX)) {
    return true;
  }

  const communityId =
    typeof doc.communityId === 'string'
      ? doc.communityId
      : typeof doc.communityContextId === 'string'
        ? doc.communityContextId
        : typeof doc.parentCommunityId === 'string'
          ? doc.parentCommunityId
          : '';

  if (
    communityId === ENTREPRENEURS_DEMO_COMMUNITY_ID ||
    communityId.startsWith(DEMO_ENT_PREFIX)
  ) {
    return true;
  }

  if (collection === 'users') {
    const authId = typeof doc.authId === 'string' ? doc.authId : '';
    return authId.startsWith('demo_ent:');
  }

  return false;
}

@Injectable()
export class PlatformDemoPackImportService {
  private readonly logger = new Logger(PlatformDemoPackImportService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  parseMeriterDemoPackV1(json: string): MeriterDemoPackV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch {
      throw new BadRequestException('packJson is not valid JSON');
    }
    const checked = MeriterDemoPackV1Schema.safeParse(parsed);
    if (!checked.success) {
      throw new BadRequestException('Invalid MeriterDemoPackV1 format');
    }
    return checked.data;
  }

  isMeriterDemoPackV1Json(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as unknown;
      return MeriterDemoPackV1Schema.safeParse(parsed).success;
    } catch {
      return false;
    }
  }

  async importMeriterDemoPackV1(
    pack: MeriterDemoPackV1,
  ): Promise<{ documentsUpserted: number; collections: number }> {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection has no database handle');
    }

    let documentsUpserted = 0;
    let collections = 0;

    for (const [collectionName, documents] of Object.entries(pack.collections)) {
      if (FORBIDDEN_COLLECTIONS.has(collectionName)) {
        throw new BadRequestException(
          `Collection "${collectionName}" cannot be imported via demo pack merge`,
        );
      }

      if (!Array.isArray(documents) || documents.length === 0) {
        continue;
      }

      collections += 1;
      const col = db.collection(collectionName);

      for (const raw of documents) {
        const doc = raw as Record<string, unknown>;
        if (!isAllowedDemoDocument(collectionName, doc)) {
          throw new BadRequestException(
            `Document in "${collectionName}" is outside entrepreneurs demo scope`,
          );
        }
        const id = doc.id;
        if (typeof id !== 'string' || !id) {
          throw new BadRequestException(
            `Document in "${collectionName}" must have string id`,
          );
        }

        await col.replaceOne({ id }, doc, { upsert: true });
        documentsUpserted += 1;
      }

      this.logger.log(
        `MeriterDemoPackV1 merge: ${collectionName} upserted ${documents.length} docs`,
      );
    }

    return { documentsUpserted, collections };
  }
}
