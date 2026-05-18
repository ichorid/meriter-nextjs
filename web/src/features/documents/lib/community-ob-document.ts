/** MVP hub communities never get an `imageOfFuture` document (matches API bootstrap rules). */
const HUB_TYPE_TAGS_WITHOUT_OB_DOCUMENT = [
  'future-vision',
  'marathon-of-good',
  'team-projects',
] as const;

export function communityMayHaveOfficialObDocument(typeTag?: string): boolean {
  if (typeTag === 'global') {
    return false;
  }
  if (!typeTag) {
    return true;
  }
  return !(HUB_TYPE_TAGS_WITHOUT_OB_DOCUMENT as readonly string[]).includes(typeTag);
}
