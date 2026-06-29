import type { Community } from '../../../domain/models/community/community.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { DocumentService } from '../../../domain/services/document.service';
import type { PublicationService } from '../../../domain/services/publication.service';

export type GetFutureVisionsFeedInput = {
  page?: number;
  pageSize?: number;
  tags?: string[];
  sort?: 'score' | 'createdAt';
};

export type FutureVisionFeedItem = {
  communityId: string;
  name: string;
  description?: string;
  futureVisionText?: string;
  futureVisionTags?: string[];
  futureVisionCover?: string;
  futureVisionDocumentId?: string;
  futureVisionDocumentSections?: unknown;
  publicationId: string;
  score: number;
  memberCount: number;
};

export type GetFutureVisionsFeedResult = {
  items: FutureVisionFeedItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type GetFutureVisionsFeedDeps = {
  communityService: CommunityService;
  publicationService: PublicationService;
  documentService: DocumentService;
};

/**
 * BC-03: Future Visions hub feed (communities via OB posts in the future-vision hub).
 * inv-20: feed resolves through the priority future-vision hub community.
 */
export class GetFutureVisionsFeedUseCase {
  constructor(private readonly deps: GetFutureVisionsFeedDeps) {}

  async execute(params: GetFutureVisionsFeedInput): Promise<GetFutureVisionsFeedResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const futureVision = await this.deps.communityService.getCommunityByTypeTag('future-vision');
    if (!futureVision) {
      return { items: [], total: 0, page, pageSize };
    }

    const sort: 'score' | 'createdAt' = params.sort ?? 'score';
    const obPostsRaw = await this.deps.publicationService.findObPosts(futureVision.id, {
      sort,
    });
    if (obPostsRaw.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }

    /** One feed card per source team/community; list is already sorted by score or createdAt. */
    const seenSourceIds = new Set<string>();
    const obPosts = obPostsRaw.filter((p) => {
      const sid = p.sourceEntityId;
      if (typeof sid !== 'string' || sid.length === 0) {
        return false;
      }
      if (seenSourceIds.has(sid)) {
        return false;
      }
      seenSourceIds.add(sid);
      return true;
    });

    const communityIds = [...new Set(obPosts.map((p) => p.sourceEntityId))];
    const communityDocs = await Promise.all(
      communityIds.map((id) => this.deps.communityService.getCommunity(id)),
    );
    const communityMap = new Map<string, Community>();
    for (const community of communityDocs) {
      if (community) {
        communityMap.set(community.id, community);
      }
    }

    const obDocumentMap = await this.deps.documentService.getOfficialByCommunities(
      communityIds,
      'imageOfFuture',
    );

    const tagsFilter = params.tags?.length ? new Set(params.tags) : null;
    const ordered: FutureVisionFeedItem[] = [];

    for (const post of obPosts) {
      const community = communityMap.get(post.sourceEntityId);
      if (!community) continue;
      if (community.isProject === true || community.typeTag === 'project') continue;
      if (!isCommunityEligibleForFutureVisionsFeed(community)) continue;
      if (tagsFilter && community.futureVisionTags?.length) {
        const hasTag = community.futureVisionTags.some((t) => tagsFilter.has(t));
        if (!hasTag) continue;
      } else if (tagsFilter) {
        continue;
      }

      const obDocument = obDocumentMap.get(community.id);

      ordered.push({
        communityId: community.id,
        name: community.name,
        description: community.description,
        futureVisionText: community.futureVisionText,
        futureVisionTags: community.futureVisionTags,
        futureVisionCover: community.futureVisionCover,
        futureVisionDocumentId: obDocument?.id,
        futureVisionDocumentSections: obDocument?.sections,
        publicationId: post.id,
        score: post.metrics.score,
        memberCount: Array.isArray(community.members) ? community.members.length : 0,
      });
    }

    const total = ordered.length;
    const items = ordered.slice(skip, skip + pageSize);

    return { items, total, page, pageSize };
  }
}

export function createGetFutureVisionsFeedUseCase(
  deps: GetFutureVisionsFeedDeps,
): GetFutureVisionsFeedUseCase {
  return new GetFutureVisionsFeedUseCase(deps);
}

/** Telegram-linked communities appear in OB feed only when platform integration is public. */
export function isCommunityEligibleForFutureVisionsFeed(community: Community): boolean {
  if (!community.telegramChatId) {
    return true;
  }
  if (community.settings?.telegramPlatformIntegration !== true) {
    return false;
  }
  return community.settings?.telegramPlatformVisibility === 'public';
}
