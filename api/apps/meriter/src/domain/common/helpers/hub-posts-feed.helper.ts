/**
 * Community/project hub «Посты» feed: votable regular posts only.
 * Events, projects, tickets, discussions, and Birzha showcase rows have dedicated tabs.
 */

export const HUB_POSTS_FEED_EXCLUDED_POST_TYPES = [
  'event',
  'project',
  'ticket',
  'discussion',
  'poll',
] as const;

export type HubPostsFeedExcludedPostType =
  (typeof HUB_POSTS_FEED_EXCLUDED_POST_TYPES)[number];

export type HubPostsFeedPublicationFields = {
  postType?: string | null;
  isProject?: boolean | null;
  communityId?: string | null;
  sourceEntityId?: string | null;
  sourceEntityType?: 'project' | 'community' | string | null;
};

/** Mongo filter fragment for hub «Posts» feed queries. */
export function buildHubPostsFeedMongoQuery(): Record<string, unknown> {
  return {
    postType: { $nin: [...HUB_POSTS_FEED_EXCLUDED_POST_TYPES] },
    isProject: { $ne: true },
  };
}

/** True when a publication belongs in hub «Posts» (votable regular content). */
export function isHubPostsFeedPublication(
  pub: HubPostsFeedPublicationFields,
  ctx?: {
    hubCommunityId?: string;
    birzhaCommunityId?: string | null;
  },
): boolean {
  const postType = pub.postType ?? 'basic';
  if (
    (HUB_POSTS_FEED_EXCLUDED_POST_TYPES as readonly string[]).includes(postType)
  ) {
    return false;
  }
  if (pub.isProject === true) {
    return false;
  }

  const hubCommunityId = ctx?.hubCommunityId;
  const birzhaCommunityId = ctx?.birzhaCommunityId;
  if (
    hubCommunityId &&
    birzhaCommunityId &&
    pub.communityId === birzhaCommunityId &&
    pub.sourceEntityId === hubCommunityId &&
    (pub.sourceEntityType === 'project' || pub.sourceEntityType === 'community')
  ) {
    return false;
  }

  return true;
}
