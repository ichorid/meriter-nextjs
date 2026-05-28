import type { ResourcePermissions } from '@meriter/shared-types/schemas/permissions';
import { ActionType } from '../../../domain/common/constants/action-types.constants';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { PermissionGatesPort } from '../../../domain/ports/permission-gates.port';
import type { CommentService } from '../../../domain/services/comment.service';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PermissionContextService } from '../../../domain/services/permission-context.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { PollService } from '../../../domain/services/poll.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserService } from '../../../domain/services/user.service';
import type { VoteCommentResolverService } from '../../../domain/services/vote-comment-resolver.service';
import {
  attachResourcePermissions,
  presentAnonymousCommentOrPollPermissions,
  presentAnonymousPublicationPermissions,
  presentMissingResourcePermissions,
  presentResourcePermissions,
  type ResourcePermissionFacts,
} from '../../../adapters/presenters/permissions.presenter';

export type EvaluateResourcePermissionsDeps = {
  permissionService: PermissionService;
  permissionContextService: PermissionContextService;
  permissionGates: PermissionGatesPort;
  publicationService: PublicationService;
  commentService: CommentService;
  pollService: PollService;
  communityService: CommunityService;
  userService: UserService;
  voteCommentResolver: VoteCommentResolverService;
};

/**
 * BC-05 / BC-18: evaluate ResourcePermissions for publications, comments, and polls.
 * inv-08: server-side checks only; inv-11: disabled reasons are i18n keys via presenter.
 */
export class EvaluateResourcePermissionsUseCase {
  constructor(private readonly deps: EvaluateResourcePermissionsDeps) {}

  async forPublication(
    userId: string | null | undefined,
    publicationId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return presentAnonymousPublicationPermissions();
    }

    const publication = await this.deps.publicationService.getPublication(publicationId);
    if (!publication) {
      return presentMissingResourcePermissions();
    }

    const communityId = publication.getCommunityId.getValue();
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const snapshot = publication.toSnapshot();
    const isProject = snapshot.postType === 'project' || snapshot.isProject === true;

    const postTypeGate = this.deps.permissionGates.evaluatePublicationVotePostTypeGate({
      postType: snapshot.postType,
      isProject,
    });

    if (postTypeGate.blocksVote) {
      const canEdit = await this.deps.permissionService.canEditPublication(
        userId,
        publicationId,
      );
      const canDelete = await this.deps.permissionService.canDeletePublication(
        userId,
        publicationId,
      );
      const canComment = await this.deps.permissionService.canComment(userId, publicationId);

      return presentResourcePermissions({
        canVote: false,
        canEdit,
        canDelete,
        canComment,
        canTopUpFromSourceEntityWallet: false,
        voteDisabledReason: postTypeGate.voteDisabledReason,
        editDisabledReason: canEdit
          ? undefined
          : this.getEditDisabledReason(publication, userId, authorId),
        deleteDisabledReason: canDelete
          ? undefined
          : this.getDeleteDisabledReason(publication, userId, authorId),
      });
    }

    const community = await this.deps.communityService.getCommunity(communityId);
    if (!community || community === null) {
      return presentResourcePermissions({
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        canTopUpFromSourceEntityWallet: false,
        voteDisabledReason: 'voteDisabled.noCommunity',
      });
    }

    const context = await this.deps.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    const user = await this.deps.userService.getUserById(userId);
    const userRole = await this.deps.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );
    const isAuthor = context.isAuthor ?? false;
    const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
    const isBeneficiary = hasBeneficiary && beneficiaryId === userId;

    const canVote = await this.deps.permissionService.canVote(userId, publicationId);
    const canEdit = await this.deps.permissionService.canEditPublication(
      userId,
      publicationId,
    );
    const canDelete = await this.deps.permissionService.canDeletePublication(
      userId,
      publicationId,
    );
    const canComment = await this.deps.permissionService.canComment(userId, publicationId);
    const canTopUpFromSourceEntityWallet =
      await this.deps.permissionService.isUserManagingBirzhaSourcePost(
        userId,
        publicationId,
      );

    let voteDisabledReason: string | undefined;
    if (!canVote) {
      const isProjectCommunity = community.isProject === true;
      const pt = snapshot.postType;
      if (isProjectCommunity && pt === 'discussion' && authorId === userId) {
        voteDisabledReason = 'voteDisabled.projectOwnDiscussion';
      } else if (
        isProjectCommunity &&
        pt === 'ticket' &&
        beneficiaryId &&
        beneficiaryId === userId
      ) {
        voteDisabledReason = 'voteDisabled.projectOwnTicket';
      } else if (context.isEffectiveBeneficiary) {
        const effectiveRules =
          this.deps.communityService.getEffectivePermissionRules(community);
        const voteRule = effectiveRules.find(
          (rule) => rule.role === userRole && rule.action === ActionType.VOTE,
        );
        if (voteRule?.conditions?.canVoteForOwnPosts === false) {
          voteDisabledReason = 'voteDisabled.isAuthor';
        } else {
          voteDisabledReason = this.getVoteDisabledReason(
            user,
            userRole,
            community,
            isProject,
          );
        }
      } else {
        voteDisabledReason = this.getVoteDisabledReason(
          user,
          userRole,
          community,
          isProject,
        );
      }
    }

    return presentResourcePermissions({
      canVote,
      canEdit,
      canDelete,
      canComment,
      canTopUpFromSourceEntityWallet,
      voteDisabledReason,
      editDisabledReason: canEdit
        ? undefined
        : this.getEditDisabledReason(publication, userId, authorId),
      deleteDisabledReason: canDelete
        ? undefined
        : this.getDeleteDisabledReason(publication, userId, authorId),
    });
  }

  async forComment(
    userId: string | null | undefined,
    commentId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return presentAnonymousCommentOrPollPermissions();
    }

    const comment = await this.deps.commentService.getComment(commentId);
    if (!comment) {
      return presentMissingResourcePermissions();
    }

    const authorId = comment.getAuthorId.getValue();

    const canEdit = await this.deps.permissionService.canEditComment(userId, commentId);
    const canDelete = await this.deps.permissionService.canDeleteComment(userId, commentId);

    const enableCommentVoting = this.deps.permissionGates.isCommentVotingEnabled();

    let canVote = false;
    let voteDisabledReason: string | undefined;

    if (!enableCommentVoting) {
      canVote = false;
      voteDisabledReason = 'voteDisabled.commentVotingDisabled';
    } else {
      try {
        const resolved = await this.deps.voteCommentResolver.resolve(commentId);

        if (resolved.vote) {
          canVote = await this.deps.permissionService.canVoteOnVote(
            userId,
            resolved.vote.id,
          );
          if (!canVote) {
            voteDisabledReason = 'voteDisabled.roleNotAllowed';
          }
        } else {
          canVote = true;
        }
      } catch {
        canVote = false;
        voteDisabledReason = 'voteDisabled.commentVotingDisabled';
      }
    }

    return presentResourcePermissions({
      canVote,
      canEdit,
      canDelete,
      canComment: true,
      voteDisabledReason: canVote ? undefined : voteDisabledReason,
      editDisabledReason: canEdit
        ? undefined
        : this.getCommentEditDisabledReason(comment, userId, authorId),
      deleteDisabledReason: canDelete ? undefined : 'Cannot delete comment',
    });
  }

  async forPoll(
    userId: string | null | undefined,
    pollId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return presentAnonymousCommentOrPollPermissions();
    }

    const poll = await this.deps.pollService.getPoll(pollId);
    if (!poll) {
      return presentMissingResourcePermissions();
    }

    const canEdit = await this.deps.permissionService.canEditPoll(userId, pollId);
    const canDelete = await this.deps.permissionService.canDeletePoll(userId, pollId);

    const snapshot = poll.toSnapshot();
    const canVote = snapshot.isActive && !poll.hasExpired();
    const canComment = false;

    return presentResourcePermissions({
      canVote,
      canEdit,
      canDelete,
      canComment,
      editDisabledReason: canEdit ? undefined : 'Cannot edit poll',
      deleteDisabledReason: canDelete ? undefined : 'Cannot delete poll',
    });
  }

  async batchForPublications(
    userId: string | null | undefined,
    publicationIds: string[],
  ): Promise<Map<string, ResourcePermissions>> {
    const permissionsMap = new Map<string, ResourcePermissions>();

    if (!userId || publicationIds.length === 0) {
      publicationIds.forEach((id) => {
        permissionsMap.set(
          id,
          userId
            ? presentMissingResourcePermissions()
            : presentAnonymousPublicationPermissions(),
        );
      });
      return permissionsMap;
    }

    const permissions = await Promise.all(
      publicationIds.map((id) => this.forPublication(userId, id)),
    );

    publicationIds.forEach((id, index) => {
      permissionsMap.set(id, permissions[index]);
    });

    return permissionsMap;
  }

  async batchForComments(
    userId: string | null | undefined,
    commentIds: string[],
  ): Promise<Map<string, ResourcePermissions>> {
    const permissionsMap = new Map<string, ResourcePermissions>();

    if (!userId || commentIds.length === 0) {
      commentIds.forEach((id) => {
        permissionsMap.set(
          id,
          userId
            ? presentMissingResourcePermissions()
            : presentAnonymousCommentOrPollPermissions(),
        );
      });
      return permissionsMap;
    }

    const permissions = await Promise.all(
      commentIds.map((id) => this.forComment(userId, id)),
    );

    commentIds.forEach((id, index) => {
      permissionsMap.set(id, permissions[index]);
    });

    return permissionsMap;
  }

  /** Attach permissions to a mapped DTO (post EntityMappers). */
  attachToDto<T extends object>(
    dto: T,
    permissions: ResourcePermissions,
  ): T & { permissions: ResourcePermissions } {
    return attachResourcePermissions(dto, permissions);
  }

  private getVoteDisabledReason(
    user: { globalRole?: string } | null | undefined,
    userRole: string | null,
    community: unknown,
    isProject: boolean,
  ): string | undefined {
    if (!user) {
      return 'voteDisabled.notLoggedIn';
    }

    if (user.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return undefined;
    }

    if (isProject) {
      return 'voteDisabled.projectPost';
    }

    if (!community) {
      return 'voteDisabled.noCommunity';
    }

    if (!userRole) {
      return 'voteDisabled.roleNotAllowed';
    }

    return undefined;
  }

  private getEditDisabledReason(
    publication: { toSnapshot(): { deleted?: boolean } },
    _userId: string,
    _authorId: string,
  ): string | undefined {
    const snapshot = publication.toSnapshot();
    if (snapshot.deleted) {
      return 'editDisabled.deleted';
    }

    return 'editDisabled.timeWindowExpired';
  }

  private getDeleteDisabledReason(
    publication: {
      getMetrics: { toSnapshot(): { upvotes: number; downvotes: number; commentCount?: number } };
    },
    _userId: string,
    _authorId: string,
  ): string | undefined {
    const metricsSnapshot = publication.getMetrics.toSnapshot();
    const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
    const commentCount = metricsSnapshot.commentCount || 0;

    if (totalVotes > 0) {
      return 'deleteDisabled.hasVotes';
    }

    if (commentCount > 0) {
      return 'deleteDisabled.hasComments';
    }

    return 'deleteDisabled.insufficientPermissions';
  }

  private getCommentEditDisabledReason(
    comment: {
      getMetrics: { toSnapshot(): { upvotes: number; downvotes: number } };
    },
    _userId: string,
    _authorId: string,
  ): string | undefined {
    const metricsSnapshot = comment.getMetrics.toSnapshot();
    const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;

    if (totalVotes > 0) {
      return 'editDisabled.hasVotes';
    }

    return 'editDisabled.timeWindowExpired';
  }
}

export function createEvaluateResourcePermissionsUseCase(
  deps: EvaluateResourcePermissionsDeps,
): EvaluateResourcePermissionsUseCase {
  return new EvaluateResourcePermissionsUseCase(deps);
}
