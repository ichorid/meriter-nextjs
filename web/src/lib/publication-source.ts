/** Align with api `publication-source.helper.ts` — entity-sourced vs personal user post. */
export type PublicationSourceFields = {
  authorKind?: 'user' | 'community';
  sourceEntityType?: 'project' | 'community';
};

export function isPublicationEntitySourced(post: PublicationSourceFields): boolean {
  if (post.authorKind === 'community') return true;
  return (
    post.sourceEntityType === 'project' || post.sourceEntityType === 'community'
  );
}
