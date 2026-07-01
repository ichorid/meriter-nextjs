import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Community } from '../../domain/models/community/community.schema';
import {
  CommunitySchemaClass,
  type CommunityDocument,
} from '../../domain/models/community/community.schema';
import { expandTelegramChatIds, telegramChatIdLookupVariants } from './telegram-chat-id.util';

export type TelegramCommunityChatResolverDeps = {
  communityModel: Model<CommunityDocument>;
};

/** Extract stored legacy Telegram chat ids from community settings. */
export function extractCommunityLegacyChatIds(community?: Community | null): string[] {
  const raw = community?.settings?.telegramLegacyChatIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

/** Telegram API chat ids for a community (current + migration legacy aliases). */
export function chatIdsForTelegramApi(community: Community, hintChatId?: string): string[] {
  const legacy = extractCommunityLegacyChatIds(community);
  const primary =
    hintChatId?.trim() ||
    (community.telegramChatId ? String(community.telegramChatId) : '');
  return expandTelegramChatIds(primary, legacy);
}

/** Prefer active community when multiple rows match the same chat id (e.g. archived duplicate). */
export function pickPreferredCommunityMatch<T extends Community>(matches: T[]): T | null {
  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    return matches[0]!;
  }
  const active = matches.filter((doc) => !doc.telegramFrozenAt);
  const pool = active.length > 0 ? active : matches;
  pool.sort((a, b) => {
    const aArchived = /archived duplicate/i.test(a.name ?? '') ? 1 : 0;
    const bArchived = /archived duplicate/i.test(b.name ?? '') ? 1 : 0;
    if (aArchived !== bArchived) {
      return aArchived - bArchived;
    }
    return String(b.updatedAt ?? 0).localeCompare(String(a.updatedAt ?? 0));
  });
  return pool[0]!;
}

/**
 * Single lookup module for inbound Telegram chat id → community resolution.
 * Covers current id, supergroup variants, and post-migration legacy ids.
 */
@Injectable()
export class TelegramCommunityChatResolver {
  private readonly logger = new Logger(TelegramCommunityChatResolver.name);

  constructor(
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
  ) {}

  /** Non-frozen for mini-app boot: field must be absent ($exists: false), not null. */
  isActiveForTelegramMiniApp(community: Community): boolean {
    return !Object.prototype.hasOwnProperty.call(community, 'telegramFrozenAt');
  }

  async resolveByIncomingChatId(telegramChatId: string): Promise<Community | null> {
    const variants = telegramChatIdLookupVariants(telegramChatId);
    if (variants.length === 0) {
      return null;
    }
    const matches = await this.communityModel
      .find({
        $or: [
          { telegramChatId: { $in: variants } },
          { 'settings.telegramLegacyChatIds': { $in: variants } },
        ],
      })
      .lean();
    if (matches.length === 0) {
      return null;
    }
    const picked = pickPreferredCommunityMatch(matches as Community[]);
    if (matches.length > 1 && picked) {
      this.logger.debug(
        `Resolved chat id ${telegramChatId} to community ${picked.id} among ${matches.length} matches`,
      );
    }
    return picked;
  }

  /** Chat ids to try for Telegram Bot API calls (vote feedback, panel refresh). */
  chatIdsForApi(community: Community, hintChatId?: string): string[] {
    return chatIdsForTelegramApi(community, hintChatId);
  }

  communityLegacyChatIds(community?: Community | null): string[] {
    return extractCommunityLegacyChatIds(community);
  }

  /** Mini-app / auth: resolve community id; excludes frozen communities. */
  async resolveCommunityIdForMiniApp(telegramChatId: string): Promise<string | null> {
    const community = await this.resolveByIncomingChatId(telegramChatId);
    if (!community?.id || !this.isActiveForTelegramMiniApp(community)) {
      return null;
    }
    return community.id;
  }
}

/** Factory for use cases constructed outside Nest DI. */
export function createTelegramCommunityChatResolver(
  deps: TelegramCommunityChatResolverDeps,
): Pick<
  TelegramCommunityChatResolver,
  | 'resolveByIncomingChatId'
  | 'chatIdsForApi'
  | 'communityLegacyChatIds'
  | 'isActiveForTelegramMiniApp'
  | 'resolveCommunityIdForMiniApp'
> {
  const resolver = {
    async resolveByIncomingChatId(telegramChatId: string): Promise<Community | null> {
      const variants = telegramChatIdLookupVariants(telegramChatId);
      if (variants.length === 0) {
        return null;
      }
      const matches = await deps.communityModel
        .find({
          $or: [
            { telegramChatId: { $in: variants } },
            { 'settings.telegramLegacyChatIds': { $in: variants } },
          ],
        })
        .lean();
      return pickPreferredCommunityMatch(matches as Community[]);
    },
    chatIdsForApi(community: Community, hintChatId?: string): string[] {
      return chatIdsForTelegramApi(community, hintChatId);
    },
    communityLegacyChatIds(community?: Community | null): string[] {
      return extractCommunityLegacyChatIds(community);
    },
    isActiveForTelegramMiniApp(community: Community): boolean {
      return !Object.prototype.hasOwnProperty.call(community, 'telegramFrozenAt');
    },
    async resolveCommunityIdForMiniApp(telegramChatId: string): Promise<string | null> {
      const community = await resolver.resolveByIncomingChatId(telegramChatId);
      if (!community?.id || !resolver.isActiveForTelegramMiniApp(community)) {
        return null;
      }
      return community.id;
    },
  };
  return resolver;
}
