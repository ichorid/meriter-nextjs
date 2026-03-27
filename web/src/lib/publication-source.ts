/** Align with api `publication-source.helper.ts` — entity-sourced vs personal user post. */
export type PublicationSourceFields = {
  authorKind?: 'user' | 'community';
  sourceEntityType?: 'project' | 'community';
  /** Community-authored posts: present when authorKind=community; some payloads omit authorKind. */
  authoredCommunityId?: string;
};

export function isPublicationEntitySourced(post: PublicationSourceFields): boolean {
  if (post.authorKind === 'community') return true;
  if (
    post.sourceEntityType === 'project' ||
    post.sourceEntityType === 'community'
  ) {
    return true;
  }
  if (post.authoredCommunityId) return true;
  return false;
}
