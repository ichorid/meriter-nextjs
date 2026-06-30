export const OFFICIAL_BLOCK_VOTE_TARGET_SEP = '::';

export function buildOfficialBlockVoteTargetId(documentId: string, blockId: string): string {
  return `${documentId}${OFFICIAL_BLOCK_VOTE_TARGET_SEP}${blockId}`;
}

export function parseOfficialBlockVoteTargetId(
  targetId: string,
): { documentId: string; blockId: string } | null {
  const idx = targetId.indexOf(OFFICIAL_BLOCK_VOTE_TARGET_SEP);
  if (idx <= 0) {
    return null;
  }
  const documentId = targetId.slice(0, idx);
  const blockId = targetId.slice(idx + OFFICIAL_BLOCK_VOTE_TARGET_SEP.length);
  if (!documentId || !blockId) {
    return null;
  }
  return { documentId, blockId };
}
