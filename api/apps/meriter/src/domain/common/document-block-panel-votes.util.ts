import { buildOfficialBlockVoteTargetId } from './document-official-vote.util';

export type DocumentPanelVoteRow = {
  targetType: string;
  targetId: string;
  createdAt: Date;
};

export function filterDocumentBlockPanelVotes<T extends DocumentPanelVoteRow>(
  votes: T[],
  input: {
    documentId: string;
    blockId: string;
    currentWaveStartedAt?: Date | string | null;
    activeVariantIds: string[];
  },
): T[] {
  const officialTargetId = buildOfficialBlockVoteTargetId(input.documentId, input.blockId);
  const activeVariantIdSet = new Set(input.activeVariantIds);

  const waveStartMs = input.currentWaveStartedAt
    ? new Date(input.currentWaveStartedAt).getTime()
    : null;
  const waveFilterActive = waveStartMs != null && !Number.isNaN(waveStartMs);

  return votes.filter((vote) => {
    if (waveFilterActive && new Date(vote.createdAt).getTime() < waveStartMs!) {
      return false;
    }
    if (vote.targetType === 'document-block-official') {
      return vote.targetId === officialTargetId;
    }
    if (vote.targetType === 'document-variant') {
      return activeVariantIdSet.has(vote.targetId);
    }
    return false;
  });
}
