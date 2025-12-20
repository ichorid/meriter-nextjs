import { Injectable, Logger } from '@nestjs/common';
import { PermissionService } from '../../../domain/services/permission.service';
import { PublicationService } from '../../../domain/services/publication.service';
import { CommentService } from '../../../domain/services/comment.service';
import { PollService } from '../../../domain/services/poll.service';
import { CommunityService } from '../../../domain/services/community.service';
import { UserService } from '../../../domain/services/user.service';
import { VoteService } from '../../../domain/services/vote.service';
import { VoteCommentResolverService } from './vote-comment-resolver.service';
import { ResourcePermissions } from '../interfaces/resource-permissions.interface';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_PARTICIPANT, COMMUNITY_ROLE_VIEWER } from '../../../domain/common/constants/roles.constants';

/**
 * Service to calculate and batch-calculate permissions for resources
 * Provides ResourcePermissions objects that can be embedded in API responses
 */
@Injectable()
export class PermissionsHelperService {
  private readonly logger = new Logger(PermissionsHelperService.name);

  constructor(
    private permissionService: PermissionService,
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

    // Get user and role
    const user = await this.userService.getUserById(userId);
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    const isAuthor = authorId === userId;
    const hasBeneficiary = !!(beneficiaryId && beneficiaryId !== authorId);
    const isBeneficiary = hasBeneficiary && beneficiaryId === userId;
    const isEffectiveBeneficiary = isBeneficiary || (isAuthor && !hasBeneficiary);

    // Check permissions
    const canVote = await this.permissionService.canVote(userId, publicationId);
    const canEdit = await this.permissionService.canEditPublication(userId, publicationId);
    const canDelete = await this.permissionService.canDeletePublication(userId, publicationId);
    const canComment = await this.permissionService.canComment(userId, publicationId);

    // Determine vote disabled reason
    // Only determine reason if canVote is false
    // Community should exist here since we checked above - use it directly
    let voteDisabledReason: string | undefined;
    if (!canVote) {
      // Community should always exist here due to check above
      // If it doesn't, something is wrong - but we already returned early if community was null
      // So we can safely use community here
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
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    const isAuthor = authorId === userId;

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
          // This is a vote-comment - check if user can vote on this vote
          // Use VoteService to check mutual exclusivity and permissions
          canVote = await this.voteService.canUserVote(userId, 'vote', resolved.vote.id, communityId);
          
          if (!canVote) {
            // Check if it's because user is the author (mutual exclusivity)
            if (resolved.vote.userId === userId) {
              voteDisabledReason = 'voteDisabled.isAuthor';
            } else {
              voteDisabledReason = 'voteDisabled.roleNotAllowed';
            }
          }
        } else {
          // Regular comment - check mutual exclusivity (can't vote on own comment)
          if (isAuthor) {
            canVote = false;
            voteDisabledReason = 'voteDisabled.isAuthor';
          } else {
            // Allow voting on regular comments if feature is enabled and not own comment
            canVote = true;
          }
        }
      } catch (error) {
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
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    const isAuthor = authorId === userId;

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
   */
  private getVoteDisabledReason(
    user: any,
    userRole: string | null,
    community: any,
    isAuthor: boolean,
    isBeneficiary: boolean,
    hasBeneficiary: boolean,
    isProject: boolean,
    publicationId: string,
  ): string {
    if (!user) {
      return 'voteDisabled.notLoggedIn';
    }

    // Superadmin can vote on all posts except own (handled in canVote, but check here as safeguard)
    if (user.globalRole === GLOBAL_ROLE_SUPERADMIN && !isAuthor) {
      return undefined as any; // No reason - superadmin can vote
    }

    if (isProject) {
      return 'voteDisabled.projectPost';
    }

    // Community should always be provided when called from calculatePublicationPermissions
    // since we verify it exists before calling this method.
    // If community is somehow missing (shouldn't happen), we can't determine the reason properly
    // In this case, we'll skip the community-specific checks and fall through to other checks
    // But ideally this should never happen, so we check defensively
    if (!community) {
      // Can't determine reason without community - this is a fallback
      // Should not happen in normal flow
      return 'voteDisabled.noCommunity';
    }

    // Check team community restrictions
    if (community.typeTag === 'team' && isAuthor) {
      return 'voteDisabled.teamOwnPost';
    }

    // Check mutual exclusivity
    if (isBeneficiary) {
      return 'voteDisabled.isBeneficiary';
    }

    if (isAuthor && !hasBeneficiary) {
      // Exception: future-vision allows self-voting
      if (community.typeTag === 'future-vision' && 
          (userRole === 'participant' || userRole === 'lead' || userRole === 'superadmin')) {
        // Allow self-voting in future-vision, so no reason
        return undefined as any;
      }
      return 'voteDisabled.isAuthor';
    }

    // Check role restrictions
    // Special handling for support communities: participants can always vote
    // This matches the logic in permission.service.ts canVote method
    const isSupportCommunityParticipant = community.typeTag === 'support' && userRole === COMMUNITY_ROLE_PARTICIPANT;
    
    if (userRole && community.votingRules) {
      // Skip allowedRoles check for support community participants
      if (!isSupportCommunityParticipant && !community.votingRules.allowedRoles.includes(userRole)) {
        return 'voteDisabled.roleNotAllowed';
      }

      // Check own post restriction
      if (isAuthor && !community.votingRules.canVoteForOwnPosts) {
        // Exception: future-vision allows self-voting
        if (community.typeTag === 'future-vision' && 
            (userRole === 'participant' || userRole === 'lead' || userRole === 'superadmin')) {
          return undefined as any;
        }
        return 'voteDisabled.ownPostNotAllowed';
      }
    }

    // Check viewer restrictions
    if (userRole === COMMUNITY_ROLE_VIEWER && community.typeTag !== 'marathon-of-good') {
      return 'voteDisabled.viewerNotMarathon';
    }

    return undefined as any;
  }

  /**
   * Get the reason why editing is disabled
   */
  private getEditDisabledReason(
    publication: any,
    userId: string,
    authorId: string,
  ): string | undefined {
    const metrics = publication.getMetrics;
    const metricsSnapshot = metrics.toSnapshot();
    const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
    const commentCount = metricsSnapshot.commentCount || 0;

    if (totalVotes > 0) {
      return 'editDisabled.hasVotes';
    }

    if (commentCount > 0) {
      return 'editDisabled.hasComments';
    }

    // Check time window would be done by PermissionService
    return 'editDisabled.timeWindowExpired';
  }

  /**
   * Get the reason why deletion is disabled
   */
  private getDeleteDisabledReason(
    publication: any,
    userId: string,
    authorId: string,
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
    userId: string,
    authorId: string,
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

