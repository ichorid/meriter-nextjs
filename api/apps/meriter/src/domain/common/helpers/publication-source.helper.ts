/**
 * Whether a publication is authored on behalf of a project/community (Birzha / logical entity),
 * vs a personal user-authored post. Legacy rows may only have sourceEntityType set.
 */
export type PublicationSourceFields = {
  authorKind?: 'user' | 'community';
  sourceEntityType?: 'project' | 'community';
};

export function isPublicationEntitySourced(
  post: PublicationSourceFields,
): boolean {
  if (post.authorKind === 'community') return true;
  return (
    post.sourceEntityType === 'project' || post.sourceEntityType === 'community'
  );
}
