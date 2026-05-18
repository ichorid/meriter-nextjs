/**
 * Collaborative documents migration + bootstrap rules.
 * @see docs/prd/shared-document/business-approved-tz.md §5.1
 */

/** Bump when migration logic changes (re-run on next API start). */
export const COLLABORATIVE_DOCUMENTS_MIGRATION_REVISION = 2;

/**
 * Global MVP hub communities: no `imageOfFuture` document on the hub itself.
 * Source communities / cooperative projects still get OB / description documents.
 */
export const PRIORITY_HUB_TYPE_TAGS_WITHOUT_OB_DOCUMENT = [
  'future-vision',
  'marathon-of-good',
  'team-projects',
] as const;

export type PriorityHubTypeTagWithoutObDocument =
  (typeof PRIORITY_HUB_TYPE_TAGS_WITHOUT_OB_DOCUMENT)[number];

export function isPriorityHubWithoutObDocument(typeTag?: string): boolean {
  if (!typeTag) {
    return false;
  }
  return (PRIORITY_HUB_TYPE_TAGS_WITHOUT_OB_DOCUMENT as readonly string[]).includes(
    typeTag,
  );
}

export function shouldBootstrapImageOfFutureDocument(typeTag?: string): boolean {
  if (typeTag === 'global') {
    return false;
  }
  if (!typeTag) {
    /** User-created communities often omit typeTag; they still need an ОБ document. */
    return true;
  }
  return !isPriorityHubWithoutObDocument(typeTag);
}
