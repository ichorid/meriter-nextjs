import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';
import { PollService } from './poll.service';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_PARTICIPANT, COMMUNITY_ROLE_VIEWER } from '../common/constants/roles.constants';
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
   * Uses permission rule engine
   */
  async canCreatePublication(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.POST_PUBLICATION,
    );
  }

  /**
   * Check if user can create polls in a community
   * Uses permission rule engine
   */
  async canCreatePoll(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    return this.permissionRuleEngine.canPerformAction(
      userId,
      communityId,
      ActionType.CREATE_POLL,
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

    const communityId = publication.getCommunityId.getValue();
    
    // Build context for editing
    const context = await this.permissionContextService.buildContextForPublication(
      userId,
      publicationId,
    );

    // Get community to check editWindowDays
    const community = await this.communityService.getCommunity(communityId);
    if (community && context.daysSinceCreation !== undefined) {
      const editWindowDays = community.settings?.editWindowDays ?? 7;
      // Update context with edit window days for condition evaluation
      // This is handled in the rule engine's condition evaluation
    }

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

    // Get community to check editWindowDays
    const community = await this.communityService.getCommunity(communityId);
    if (community && context.daysSinceCreation !== undefined) {
      const editWindowDays = community.settings?.editWindowDays ?? 7;
      // Update context with edit window days for condition evaluation
    }

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

    // Check if requester is lead in the community
    const requesterRole = await this.getUserRoleInCommunity(requesterId, communityId);
    return requesterRole === COMMUNITY_ROLE_LEAD;
  }
}
