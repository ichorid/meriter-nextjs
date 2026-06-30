/**
 * PermissionGatesPort — BC-05 product / post-type gates (Phase 3 stub).
 *
 * Phase 3: PermissionRuleEngine delegates here; infrastructure adapter is the sole
 * importer of permissions-helper (zone 7 / V-11). Phase 5: inline into engine and
 * delete permission-gates.adapter.ts after signed OD-3.
 */
export const PERMISSION_GATES_PORT = Symbol('PERMISSION_GATES_PORT');

export interface PublicationPostTypeGateInput {
  postType?: string;
  isProject?: boolean;
}

export interface PostTypeGateResult {
  blocksVote: boolean;
  voteDisabledReason?: string;
}

/**
 * Product gates interim port (V-06). Replaces direct permissions-helper usage in domain.
 */
export interface PermissionGatesPort {
  /**
   * inv-05 / post-type matrix: event and project publications cannot receive votes.
   */
  evaluatePublicationVotePostTypeGate(
    input: PublicationPostTypeGateInput,
  ): PostTypeGateResult;

  /**
   * inv-19: ENABLE_COMMENT_VOTING runtime gate.
   */
  isCommentVotingEnabled(): boolean;
}
