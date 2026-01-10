import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';
import { PollService } from './poll.service';
import { VoteService } from './vote.service';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_PARTICIPANT } from '../common/constants/roles.constants';
import { ActionType } from '../common/constants/action-types.constants';
import { PermissionRuleEngine } from './permission-rule-engine.service';
import { PermissionContextService } from './permission-context.service';

/**
 * PermissionService
 *
 * Service for checking user permissions based on community configuration and roles.
 * All permission checks use community configuration rules, not hardcoded logic.
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private userService: UserService,
    private communityService: CommunityService,
    private publicationService: PublicationService,
    private commentService: CommentService,
    private userCommunityRoleService: UserCommunityRoleService,
    private pollService: PollService,
    @Inject(forwardRef(() => VoteService))
    private voteService: VoteService,
    private permissionRuleEngine: PermissionRuleEngine,
    private permissionContextService: PermissionContextService,
  ) { }

  /**
   * Get user role in a community
   * Checks global superadmin role first, then UserCommunityRole
   */
  async getUserRoleInCommunity(
    userId: string,
    communityId: string,
  ): Promise<'superadmin' | 'lead' | 'participant' | 'viewer' | null> {
    // 1. Check global superadmin role
    const user = await this.userService.getUserById(userId);
    this.logger.log(
      `[getUserRoleInCommunity] userId=${userId}, communityId=${communityId}, user=${user ? 'found' : 'not found'}, user.globalRole=${user?.globalRole}, GLOBAL_ROLE_SUPERADMIN=${GLOBAL_ROLE_SUPERADMIN}`,
    );
    if (user?.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      this.logger.log(`[getUserRoleInCommunity] User ${userId} is superadmin (globalRole)`);
      return COMMUNITY_ROLE_SUPERADMIN;
    }

    // 2. Get role from UserCommunityRole
    const userRole = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );

    this.logger.log(
      `[getUserRoleInCommunity] userRole from UserCommunityRole=${userRole?.role}`,
    );

    if (userRole?.role) {
      return userRole.role;
    }

    return null;
  }

  /**
   * Check if user can create publications in a community
   * Uses permission rule engine with context for condition evaluation
   */
  async canCreatePublication(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    // Build context for creation (needed for requiresTeamMembership checks)
    const context = await this.permissionContextService.buildContextForCommunity(
      userId,
      communityId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.POST_PUBLICATION,
      context,
    );
  }

  /**
   * Check if user can create polls in a community
   * Uses permission rule engine with context for condition evaluation
   */
  async canCreatePoll(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    // Build context for creation (needed for requiresTeamMembership checks)
    const context = await this.permissionContextService.buildContextForCommunity(
      userId,
      communityId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.CREATE_POLL,
      context,
    );
  }


  /**
   * Check if user can vote on a publication
   * Uses permission rule engine with context
   */
  async canVote(userId: string, publicationId: string): Promise<boolean> {
    this.logger.log(`[canVote] START: userId=${userId}, publicationId=${publicationId}`);

    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      this.logger.warn(`[canVote] Publication ${publicationId} not found`);
      return false;
    }

    const communityId = publication.getCommunityId.getValue();
    
    // Build context for voting
    const context = await this.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.VOTE,
      context,
    );
  }

  /**
   * Check if user can vote on a vote/comment
   * Uses permission rule engine with context
   */
  async canVoteOnVote(userId: string, voteId: string): Promise<boolean> {
    this.logger.log(`[canVoteOnVote] START: userId=${userId}, voteId=${voteId}`);

    const vote = await this.voteService.getVoteById(voteId);
    if (!vote) {
      this.logger.warn(`[canVoteOnVote] Vote ${voteId} not found`);
      return false;
    }

    const communityId = vote.communityId;
    
    // Build context for voting on a vote
    const context = await this.permissionContextService.buildContextForVote(
      userId,
      voteId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.VOTE,
      context,
    );
  }

  /**
   * Check if user can comment on a publication
   * Uses permission rule engine
   */
  async canComment(userId: string, publicationId: string): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const communityId = publication.getCommunityId.getValue();
    
    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.COMMENT,
    );
  }

  /**
   * Check if community is visible to user
   * Uses permission rule engine
   */
  async isCommunityVisible(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const context = await this.permissionContextService.buildContextForCommunity(
      userId,
      communityId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.VIEW_COMMUNITY,
      context,
    );
  }

  /**
   * Check if user can edit a publication
   * Uses permission rule engine with context
   */
  async canEditPublication(
    userId: string,
    publicationId: string,
  ): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return false;
    }

    // Deleted publications cannot be edited by anyone
    const snapshot = publication.toSnapshot();
    if (snapshot.deleted) {
      return false;
    }

    const communityId = publication.getCommunityId.getValue();
    
    // Build context for editing
    const context = await this.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    // Edit window enforcement is handled by PermissionRuleEngine.evaluateConditions()
    // using the publication context (minutesSinceCreation) and community settings.

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.EDIT_PUBLICATION,
      context,
    );
  }

  /**
   * Check if user can delete a publication
   * Uses permission rule engine with context
   */
  async canDeletePublication(
    userId: string,
    publicationId: string,
  ): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const communityId = publication.getCommunityId.getValue();
    
    // Build context for deletion
    const context = await this.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.DELETE_PUBLICATION,
      context,
    );
  }

  /**
   * Check if user can edit a comment
   * Uses permission rule engine with context
   */
  async canEditComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    
    // Build context for editing
    const context = await this.permissionContextService.buildContextForComment(
      userId,
      commentId,
    );

    // Comment edit window is not enforced (posts only).

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.EDIT_COMMENT,
      context,
    );
  }

  /**
   * Check if user can delete a comment
   * Uses permission rule engine
   */
  async canDeleteComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    
    // Build context for deletion
    const context = await this.permissionContextService.buildContextForComment(
      userId,
      commentId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.DELETE_COMMENT,
      context,
    );
  }

  /**
   * Check if user can edit a poll
   * Uses permission rule engine with context
   */
  async canEditPoll(userId: string, pollId: string): Promise<boolean> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) return false;

    const communityId = poll.getCommunityId;
    
    // Build context for editing
    const context = await this.permissionContextService.buildContextForPoll(
      userId,
      pollId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.EDIT_POLL,
      context,
    );
  }

  /**
   * Check if user can delete a poll
   * Uses permission rule engine with context
   */
  async canDeletePoll(userId: string, pollId: string): Promise<boolean> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) return false;

    const communityId = poll.getCommunityId;
    
    // Build context for deletion
    const context = await this.permissionContextService.buildContextForPoll(
      userId,
      pollId,
    );

    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.DELETE_POLL,
      context,
    );
  }

  /**
   * Check if user can view another user's wallet/quota data in a community
   * Returns true if:
   * - Requester is viewing their own data
   * - Requester is superadmin
   * - Requester is lead in the community
   * - Requester is participant in the community
   */
  async canViewUserMerits(
    requesterId: string,
    targetUserId: string,
    communityId: string,
  ): Promise<boolean> {
    // User can always view their own data
    if (requesterId === targetUserId) {
      return true;
    }

    // Check if requester is superadmin
    const requester = await this.userService.getUserById(requesterId);
    if (!requester) {
      return false;
    }
    
    if (requester.globalRole === GLOBAL_ROLE_SUPERADMIN) {
      return true;
    }

    // Check if requester is lead or participant in the community
    const requesterRole = await this.getUserRoleInCommunity(requesterId, communityId);
    return requesterRole === COMMUNITY_ROLE_LEAD || requesterRole === COMMUNITY_ROLE_PARTICIPANT;
  }

  /**
   * Check if user can forward a publication
   * Returns true if:
   * - Publication is in a team group
   * - User is a member of the source community (lead, participant, or viewer)
   * - Post type is 'basic' or 'project' (not 'poll')
   */
  async canForwardPublication(
    userId: string,
    publicationId: string,
    communityId: string,
  ): Promise<boolean> {
    // Check if publication exists
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return false;
    }

    // Check if community is a team group
    const community = await this.communityService.getCommunity(communityId);
    if (!community || community.typeTag !== 'team') {
      return false;
    }

    // Check if post type is forwardable (basic or project, not poll)
    const postType = (publication as any).postType || 'basic';
    if (postType === 'poll') {
      return false;
    }

    // Check if user is a member of the community (any role is fine)
    const userRole = await this.getUserRoleInCommunity(userId, communityId);
    return userRole !== null;
  }

  /**
   * Check if target community supports creating the given post type
   * Returns true if the target community's postingRules allow creating the post type
   */
  async targetCommunitySupportsPostType(
    targetCommunityId: string,
    postType: 'basic' | 'project',
    userId: string,
  ): Promise<boolean> {
    const targetCommunity = await this.communityService.getCommunity(targetCommunityId);
    if (!targetCommunity) {
      return false;
    }

    // Get user's role in target community
    const userRole = await this.getUserRoleInCommunity(userId, targetCommunityId);
    if (!userRole) {
      return false;
    }

    // Check if user can create publications in target community
    // This uses the permission rule engine which checks postingRules
    return this.canCreatePublication(userId, targetCommunityId);
  }
}
