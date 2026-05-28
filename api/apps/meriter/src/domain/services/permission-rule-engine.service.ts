import { Injectable, Inject, Logger } from '@nestjs/common';
import { forwardRef } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import { PermissionContext } from '../models/community/community.schema';
import { VoteFactorService } from './vote-factor.service';
import { VoteFactorContext } from './factors/vote-factor.types';
import { PermissionService } from './permission.service';
import {
  PublicationPostTypeGateInput,
  PostTypeGateResult,
} from '../ports/permission-gates.port';

/**
 * PermissionRuleEngine
 *
 * Core service for evaluating permissions using factorized rule engine.
 * Uses Factor 1: Role Hierarchy for permission checks.
 *
 * Product gates (inv-05 post-type matrix, inv-19 ENABLE_COMMENT_VOTING) inlined
 * after Phase 5 OD-3 merge; former zone-7 adapter deleted (V-11 retired).
 *
 * Note: Self-voting and teammate voting blocks are now currency constraints (handled in VoteService).
 * Only 'not-same-team' restriction remains as a permission block (handled by Factor 1).
 */
@Injectable()
export class PermissionRuleEngine {
  private readonly logger = new Logger(PermissionRuleEngine.name);

  constructor(
    private voteFactorService: VoteFactorService,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
  ) {}

  /**
   * inv-05: event and project publications cannot receive votes.
   */
  evaluatePublicationVotePostTypeGate(
    input: PublicationPostTypeGateInput,
  ): PostTypeGateResult {
    if (input.postType === 'event') {
      return { blocksVote: true, voteDisabledReason: 'voteDisabled.eventPost' };
    }

    const isProject =
      input.isProject === true || input.postType === 'project';
    if (isProject) {
      return { blocksVote: true, voteDisabledReason: 'voteDisabled.projectPost' };
    }

    return { blocksVote: false };
  }

  /**
   * inv-19: ENABLE_COMMENT_VOTING runtime gate.
   */
  isCommentVotingEnabled(): boolean {
    return process.env.ENABLE_COMMENT_VOTING === 'true';
  }

  /**
   * Check if user can perform action
   *
   * Uses Factor 1: Role Hierarchy for permission evaluation.
   *
   * @param userId User ID
   * @param communityId Community ID
   * @param action Action to check
   * @param context Optional permission context (for resource-specific checks)
   * @returns true if allowed, false if denied
   */
  async canPerformAction(
    userId: string,
    communityId: string,
    action: ActionType,
    context?: PermissionContext,
  ): Promise<boolean> {
    this.logger.debug(
      `[canPerformAction] userId=${userId}, communityId=${communityId}, action=${action}`,
    );

    // Convert PermissionContext to VoteFactorContext
    const voteContext: VoteFactorContext = {
      userId,
      communityId,
      action,
      ...context,
    } as VoteFactorContext;

    if (action === ActionType.VOTE && voteContext.postType) {
      const gate = this.evaluatePublicationVotePostTypeGate({
        postType: voteContext.postType,
        isProject: voteContext.isProject,
      });
      if (gate.blocksVote) {
        this.logger.debug(
          `[canPerformAction] DENIED: ${gate.voteDisabledReason ?? 'post-type product gate'}`,
        );
        return false;
      }
    }

    // Evaluate using Factor 1: Role Hierarchy
    const result = await this.voteFactorService.evaluateRoleHierarchy(
      userId,
      communityId,
      action,
      voteContext,
    );

    if (!result.allowed) {
      this.logger.debug(
        `[canPerformAction] DENIED: ${result.reason || 'Permission denied by Factor 1'}`,
      );
    } else {
      this.logger.debug(
        `[canPerformAction] ALLOWED: Permission granted by Factor 1`,
      );
    }

    return result.allowed;
  }
}
