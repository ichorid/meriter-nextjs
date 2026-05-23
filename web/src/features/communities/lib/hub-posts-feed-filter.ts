/**
 * Client-side guard for community/project hub «Посты» tab.
 * Server excludes these types too; this covers stale cache and edge cases.
 */

const HUB_POSTS_FEED_EXCLUDED_POST_TYPES = new Set([
  'event',
  'project',
  'ticket',
  'discussion',
  'poll',
]);

export type HubPostsFeedPublicationLike = {
  postType?: string | null;
  isProject?: boolean | null;
  communityId?: string | null;
  sourceEntityId?: string | null;
  sourceEntityType?: string | null;
  content?: string | null;
  type?: string | null;
};

export function isHubPostsFeedPublication(
  pub: HubPostsFeedPublicationLike,
  ctx?: {
    hubCommunityId?: string;
    birzhaCommunityId?: string | null;
  },
): boolean {
  const postType = pub.postType ?? 'basic';
  if (HUB_POSTS_FEED_EXCLUDED_POST_TYPES.has(postType)) {
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
