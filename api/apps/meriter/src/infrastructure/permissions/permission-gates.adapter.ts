import { Injectable } from '@nestjs/common';
import { PermissionsHelperService } from '../../api-v1/common/services/permissions-helper.service';
import {
  PermissionGatesPort,
  PostTypeGateResult,
  PublicationPostTypeGateInput,
} from '../../domain/ports/permission-gates.port';

/**
 * V-11 zone-7 exception: sole infrastructure→api-v1 import of permissions-helper.
 * Phase 5: delete this file after product gates are inlined into PermissionRuleEngine.
 */
@Injectable()
export class PermissionGatesAdapter implements PermissionGatesPort {
  constructor(
    /** Nest DI bridge to api-v1; gate bodies inlined until Phase 5 OD-3 merge. */
    private readonly _permissionsHelper: PermissionsHelperService,
  ) {}

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

  isCommentVotingEnabled(): boolean {
    return process.env.ENABLE_COMMENT_VOTING === 'true';
  }
}
