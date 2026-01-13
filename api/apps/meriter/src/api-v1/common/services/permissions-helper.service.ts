import { Injectable, Logger } from '@nestjs/common';
import { PermissionService } from '../../../domain/services/permission.service';
import { PublicationService } from '../../../domain/services/publication.service';
import { CommentService } from '../../../domain/services/comment.service';
import { PollService } from '../../../domain/services/poll.service';
import { CommunityService } from '../../../domain/services/community.service';
import { UserService } from '../../../domain/services/user.service';
import { VoteService } from '../../../domain/services/vote.service';
import { PermissionContextService } from '../../../domain/services/permission-context.service';
import { VoteCommentResolverService } from './vote-comment-resolver.service';
import { ResourcePermissions } from '../interfaces/resource-permissions.interface';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_VIEWER } from '../../../domain/common/constants/roles.constants';
import { ActionType } from '../../../domain/common/constants/action-types.constants';

/**
 * Service to calculate and batch-calculate permissions for resources
 * Provides ResourcePermissions objects that can be embedded in API responses
 */
@Injectable()
export class PermissionsHelperService {
  private readonly logger = new Logger(PermissionsHelperService.name);

  constructor(
    private permissionService: PermissionService,
    private permissionContextService: PermissionContextService,
    private publicationService: PublicationService,
    private commentService: CommentService,
    private pollService: PollService,
    private communityService: CommunityService,
    private userService: UserService,
    private voteService: VoteService,
    private voteCommentResolver: VoteCommentResolverService,
  ) {}

  /**
   * Calculate permissions for a publication
   */
  async calculatePublicationPermissions(
    userId: string | null | undefined,
    publicationId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        voteDisabledReason: 'voteDisabled.notLoggedIn',
      };
    }

    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
      };
    }

    const communityId = publication.getCommunityId.getValue();
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const snapshot = publication.toSnapshot();
    const isProject = snapshot.postType === 'project' || snapshot.isProject === true;

    // Check if project (cannot vote on projects)
    if (isProject) {
      const canEdit = await this.permissionService.canEditPublication(userId, publicationId);
      const canDelete = await this.permissionService.canDeletePublication(userId, publicationId);
      const canComment = await this.permissionService.canComment(userId, publicationId);

      return {
        canVote: false,
        canEdit,
        canDelete,
        canComment,
        voteDisabledReason: 'voteDisabled.projectPost',
        editDisabledReason: canEdit ? undefined : this.getEditDisabledReason(publication, userId, authorId),
        deleteDisabledReason: canDelete ? undefined : this.getDeleteDisabledReason(publication, userId, authorId),
      };
    }

    // Get community to check typeTag and rules
    const community = await this.communityService.getCommunity(communityId);
    // Explicitly check for null/undefined to ensure community exists
    if (!community || community === null) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        voteDisabledReason: 'voteDisabled.noCommunity',
      };
    }

    // Build context for permission evaluation (includes effective beneficiary info)
    const context = await this.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    // Get user and role for reason determination
    const user = await this.userService.getUserById(userId);
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    const isAuthor = context.isAuthor ?? false;
    const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
    const isBeneficiary = hasBeneficiary && beneficiaryId === userId;
    const _isEffectiveBeneficiary = context.isEffectiveBeneficiary ?? false;

    // Check permissions
    const canVote = await this.permissionService.canVote(userId, publicationId);
    const canEdit = await this.permissionService.canEditPublication(userId, publicationId);
    const canDelete = await this.permissionService.canDeletePublication(userId, publicationId);
    const canComment = await this.permissionService.canComment(userId, publicationId);

    // Determine vote disabled reason
    // Only determine reason if canVote is false
    let voteDisabledReason: string | undefined;
    if (!canVote) {
      // Check if canVoteForOwnPosts is the reason (HIGH PRIORITY)
      if (context.isEffectiveBeneficiary) {
        const effectiveRules = this.communityService.getEffectivePermissionRules(community);
        const voteRule = effectiveRules.find(
          rule => rule.role === userRole && rule.action === ActionType.VOTE
        );
        if (voteRule?.conditions?.canVoteForOwnPosts === false) {
          voteDisabledReason = 'voteDisabled.isAuthor';
        } else {
          // Community should always exist here due to check above
          voteDisabledReason = this.getVoteDisabledReason(
            user,
            userRole,
            community,
            isAuthor,
            isBeneficiary,
            hasBeneficiary,
            isProject,
            publicationId,
          );
        }
      } else {
        // Community should always exist here due to check above
        voteDisabledReason = this.getVoteDisabledReason(
          user,
          userRole,
          community,
          isAuthor,
          isBeneficiary,
          hasBeneficiary,
          isProject,
          publicationId,
        );
      }
    }

    return {
      canVote,
      canEdit,
      canDelete,
      canComment,
      voteDisabledReason,
      editDisabledReason: canEdit ? undefined : this.getEditDisabledReason(publication, userId, authorId),
      deleteDisabledReason: canDelete ? undefined : this.getDeleteDisabledReason(publication, userId, authorId),
    };
  }

  /**
   * Calculate permissions for a comment
   */
  async calculateCommentPermissions(
    userId: string | null | undefined,
    commentId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        voteDisabledReason: 'voteDisabled.notLoggedIn',
      };
    }

    const comment = await this.commentService.getComment(commentId);
    if (!comment) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
      };
    }

    const authorId = comment.getAuthorId.getValue();
    const communityId = await this.commentService.resolveCommentCommunityId(commentId);
    const _userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);

    // Check permissions
    const canEdit = await this.permissionService.canEditComment(userId, commentId);
    const canDelete = await this.permissionService.canDeleteComment(userId, commentId);

    // Check if comment voting is enabled (feature flag)
    const enableCommentVoting = process.env.ENABLE_COMMENT_VOTING === 'true';
    
    // For comment voting, check if this is a vote-comment or regular comment
    // Try to resolve as vote-comment first
    let canVote = false;
    let voteDisabledReason: string | undefined;
    
    if (!enableCommentVoting) {
      // Feature flag disabled
      canVote = false;
      voteDisabledReason = 'voteDisabled.commentVotingDisabled';
    } else {
      try {
        const resolved = await this.voteCommentResolver.resolve(commentId);
        
        if (resolved.vote) {
          // This is a vote-comment - use PermissionService to check permissions
          canVote = await this.permissionService.canVoteOnVote(userId, resolved.vote.id);
          
          if (!canVote) {
            // Permission denied for role or other reasons
            // NOTE: Self-voting is now allowed with wallet-only constraint
            voteDisabledReason = 'voteDisabled.roleNotAllowed';
          }
        } else {
          // Regular comment - voting is allowed (self-voting has currency constraint)
          // NOTE: Self-voting is allowed with wallet-only constraint, enforced in VoteService
          canVote = true;
        }
      } catch (_error) {
        // If resolution fails, default to false
        canVote = false;
        voteDisabledReason = 'voteDisabled.commentVotingDisabled';
      }
    }
    
    const canComment = true; // Users can always reply to comments

    return {
      canVote,
      canEdit,
      canDelete,
      canComment,
      voteDisabledReason: canVote ? undefined : voteDisabledReason,
      editDisabledReason: canEdit ? undefined : this.getCommentEditDisabledReason(comment, userId, authorId),
      deleteDisabledReason: canDelete ? undefined : 'Cannot delete comment',
    };
  }

  /**
   * Calculate permissions for a poll
   */
  async calculatePollPermissions(
    userId: string | null | undefined,
    pollId: string,
  ): Promise<ResourcePermissions> {
    if (!userId) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
        voteDisabledReason: 'voteDisabled.notLoggedIn',
      };
    }

    const poll = await this.pollService.getPoll(pollId);
    if (!poll) {
      return {
        canVote: false,
        canEdit: false,
        canDelete: false,
        canComment: false,
      };
    }

    const authorId = poll.getAuthorId;
    const communityId = poll.getCommunityId;
    const _userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    const _isAuthor = authorId === userId;

    // Check permissions
    const canEdit = await this.permissionService.canEditPoll(userId, pollId);
    const canDelete = await this.permissionService.canDeletePoll(userId, pollId);

    // For polls, voting is casting a vote (different from publication voting)
    // Users can cast votes on polls if they're active
    const snapshot = poll.toSnapshot();
    const canVote = snapshot.isActive && !poll.hasExpired();
    const canComment = false; // Polls don't have comments in the traditional sense

    return {
      canVote,
      canEdit,
      canDelete,
      canComment,
      editDisabledReason: canEdit ? undefined : 'Cannot edit poll',
      deleteDisabledReason: canDelete ? undefined : 'Cannot delete poll',
    };
  }

  /**
   * Batch calculate permissions for multiple publications
   */
  async batchCalculatePublicationPermissions(
    userId: string | null | undefined,
    publicationIds: string[],
  ): Promise<Map<string, ResourcePermissions>> {
    const permissionsMap = new Map<string, ResourcePermissions>();

    if (!userId || publicationIds.length === 0) {
      // Return default permissions for all
      publicationIds.forEach((id) => {
        permissionsMap.set(id, {
          canVote: false,
          canEdit: false,
          canDelete: false,
          canComment: false,
          voteDisabledReason: userId ? undefined : 'voteDisabled.notLoggedIn',
        });
      });
      return permissionsMap;
    }

    // Calculate permissions in parallel
    const permissions = await Promise.all(
      publicationIds.map((id) => this.calculatePublicationPermissions(userId, id)),
    );

    publicationIds.forEach((id, index) => {
      permissionsMap.set(id, permissions[index]);
    });

    return permissionsMap;
  }

  /**
   * Batch calculate permissions for multiple comments
   */
  async batchCalculateCommentPermissions(
    userId: string | null | undefined,
    commentIds: string[],
  ): Promise<Map<string, ResourcePermissions>> {
    const permissionsMap = new Map<string, ResourcePermissions>();

    if (!userId || commentIds.length === 0) {
      // Return default permissions for all
      commentIds.forEach((id) => {
        permissionsMap.set(id, {
          canVote: false,
          canEdit: false,
          canDelete: false,
          canComment: false,
          voteDisabledReason: userId ? undefined : 'voteDisabled.notLoggedIn',
        });
      });
      return permissionsMap;
    }

    // Calculate permissions in parallel
    const permissions = await Promise.all(
      commentIds.map((id) => this.calculateCommentPermissions(userId, id)),
    );

    commentIds.forEach((id, index) => {
      permissionsMap.set(id, permissions[index]);
    });

    return permissionsMap;
  }

  /**
   * Get the reason why voting is disabled
   * NOTE: Self-voting and teammate voting are now ALLOWED with wallet-only constraint
   * Those are not reasons to disable voting - only role/permission issues are
   */
  private getVoteDisabledReason(
    user: any,
    userRole: string | null,
    community: any,
    _isAuthor: boolean,
    _isBeneficiary: boolean,
    _hasBeneficiary: boolean,
    isProject: boolean,
    _publicationId: string,
  ): string {
    if (!user) {
      return 'voteDisabled.notLoggedIn';
    }

    // Superadmin can always vote
    if (user.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return undefined as any; // No reason - superadmin can vote
    }

    if (isProject) {
      return 'voteDisabled.projectPost';
    }

    // Community should always be provided when called from calculatePublicationPermissions
    if (!community) {
      return 'voteDisabled.noCommunity';
    }

    // NOTE: Self-voting (isAuthor, isBeneficiary) is now ALLOWED with wallet-only constraint
    // The currency constraint is enforced in VoteService, not here
    // We don't return disabled reasons for self-voting anymore

    // Check role restrictions
    if (!userRole) {
      return 'voteDisabled.roleNotAllowed';
    }

    // Check viewer restrictions (viewers can only vote in marathon-of-good and team-projects)
    if (userRole === COMMUNITY_ROLE_VIEWER && 
        community.typeTag !== 'marathon-of-good' && 
        community.typeTag !== 'team-projects') {
      return 'voteDisabled.viewerNotAllowed';
    }

    return undefined as any;
  }

  /**
   * Get the reason why editing is disabled
   */
  private getEditDisabledReason(
    publication: any,
    _userId: string,
    _authorId: string,
  ): string | undefined {
    // Check if publication is deleted - deleted posts cannot be edited
    const snapshot = publication.toSnapshot();
    if (snapshot.deleted) {
      return 'editDisabled.deleted';
    }
    
    return 'editDisabled.timeWindowExpired';
  }

  /**
   * Get the reason why deletion is disabled
   */
  private getDeleteDisabledReason(
    publication: any,
    _userId: string,
    _authorId: string,
  ): string | undefined {
    const metrics = publication.getMetrics;
    const metricsSnapshot = metrics.toSnapshot();
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

  /**
   * Get the reason why comment editing is disabled
   */
  private getCommentEditDisabledReason(
    comment: any,
    _userId: string,
    _authorId: string,
  ): string | undefined {
    const metrics = comment.getMetrics;
    const metricsSnapshot = metrics.toSnapshot();
    const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;

    if (totalVotes > 0) {
      return 'editDisabled.hasVotes';
    }

    return 'editDisabled.timeWindowExpired';
  }
}

