import { Injectable, Logger } from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import { PermissionContext } from '../models/community/community.schema';
import { VoteFactorService } from './vote-factor.service';
import { VoteFactorContext } from './factors/vote-factor.types';
import { PermissionService } from './permission.service';

/**
 * PermissionRuleEngine
 * 
 * Core service for evaluating permissions using factorized rule engine.
 * Uses Factor 1: Role Hierarchy for permission checks.
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
