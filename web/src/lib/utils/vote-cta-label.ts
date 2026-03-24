/**
 * Aligns primary vote CTA copy with VotingPopup / VotingPanel (neutral-only → "Comment", else → "Vote").
 */
export type VoteCtaCommentMode = 'all' | 'neutralOnly' | 'weightedOnly';

type CommunitySettingsSlice = {
  commentMode?: VoteCtaCommentMode;
  tappalkaOnlyMode?: boolean;
} | null | undefined;

export function resolveVoteCtaCommentMode(params: {
  publicationStatus?: string;
  postType?: string;
  communitySettings?: CommunitySettingsSlice;
}): VoteCtaCommentMode {
  if (params.publicationStatus === 'closed') {
    return 'neutralOnly';
  }
  if (params.postType === 'ticket') {
    return 'neutralOnly';
  }
  const s = params.communitySettings;
  return s?.commentMode ?? (s?.tappalkaOnlyMode ? 'neutralOnly' : 'all');
}

export function voteCtaUsesCommentLabel(mode: VoteCtaCommentMode): boolean {
  return mode === 'neutralOnly';
}
