import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';

/**
 * PermissionService
 *
 * Service for checking user permissions based on community configuration and roles.
 * All permission checks use community configuration rules, not hardcoded logic.
 */
@Injectable()
export class PermissionService {
  constructor(
    private userService: UserService,
    private communityService: CommunityService,
    private publicationService: PublicationService,
    private commentService: CommentService,
    private userCommunityRoleService: UserCommunityRoleService,
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
    if (user?.globalRole === 'superadmin') {
      return 'superadmin';
    }

    // 2. Get role from UserCommunityRole
    const userRole = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );

    if (userRole?.role) {
      return userRole.role;
    }

    // 3. Fallback: Check if user is in community adminIds (Legacy/Owner)
    const community = await this.communityService.getCommunity(communityId);
    if (community?.adminIds?.includes(userId)) {
      return 'lead';
    }

    return null;
  }

  /**
   * Check if user can create publications in a community
   * Uses postingRules from community configuration
   */
  async canCreatePublication(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    const rules = community.postingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow admins (backward compatibility)
      return community.adminIds?.includes(userId) || false;
    }

    // Check if role is allowed
    if (!rules.allowedRoles.includes(userRole as any)) return false;

    const user = await this.userService.getUserById(userId);
    if (!user) return false;

    // Additional checks from configuration
    if (rules.requiresTeamMembership && !user.teamId) return false;
    if (rules.onlyTeamLead && userRole !== 'lead') return false;

    return true;
  }

  /**
   * Check if user can vote on a publication
   * Uses votingRules from community configuration
   */
  async canVote(userId: string, publicationId: string): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const userRole = await this.getUserRoleInCommunity(
      userId,
      publication.getCommunityId.getValue(),
    );

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    const community = await this.communityService.getCommunity(
      publication.getCommunityId.getValue(),
    );
    if (!community) return false;

    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
      return true;
    }

    // Check if role is allowed
    if (!rules.allowedRoles.includes(userRole as any)) return false;

    // Check if voting for own post is allowed
    const authorId = publication.getAuthorId.getValue();
    if (authorId === userId && !rules.canVoteForOwnPosts) {
      return false;
    }

    // Check if participants cannot vote for lead posts
    // This is especially important for Good Deeds Marathon where Members cannot vote for Representative posts
    if (rules.participantsCannotVoteForLead && userRole === 'participant') {
      const authorRole = await this.getUserRoleInCommunity(
        authorId,
        publication.getCommunityId.getValue(),
      );
      if (authorRole === 'lead') {
        return false;
      }
    }

    // Additional check: For Good Deeds Marathon, Members (participants) cannot vote for Representative (lead) posts
    // This is enforced even if participantsCannotVoteForLead is not explicitly set in rules
    if (
      community.typeTag === 'marathon-of-good' &&
      userRole === 'participant'
    ) {
      const authorRole = await this.getUserRoleInCommunity(
        authorId,
        publication.getCommunityId.getValue(),
      );
      if (authorRole === 'lead') {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if user can comment on a publication
   * Uses votingRules (or can be extended with commentRules) from community configuration
   */
  async canComment(userId: string, publicationId: string): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const userRole = await this.getUserRoleInCommunity(
      userId,
      publication.getCommunityId.getValue(),
    );

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    const community = await this.communityService.getCommunity(
      publication.getCommunityId.getValue(),
    );
    if (!community) return false;

    // Use votingRules for comments (can be extended with separate commentRules)
    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
      return true;
    }

    return rules.allowedRoles.includes(userRole as any);
  }

  /**
   * Check if community is visible to user
   * Uses visibilityRules from community configuration
   */
  async isCommunityVisible(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always sees
    if (userRole === 'superadmin') return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    const rules = community.visibilityRules;
    if (!rules) {
      // Fallback: if no rules configured, check if user is member (backward compatibility)
      return (
        community.members?.includes(userId) ||
        community.adminIds?.includes(userId) ||
        false
      );
    }

    // Check if hidden
    if (rules.isHidden) return false;

    // Check if role can see
    if (!rules.visibleToRoles.includes(userRole as any)) return false;

    // Check team-only access
    if (rules.teamOnly) {
      const user = await this.userService.getUserById(userId);
      if (!user?.teamId) return false;

      // Additional team membership check can be added here
      // For now, just check if user has teamId
    }

    return true;
  }

  /**
   * Check if user can edit a publication
   */
  async canEditPublication(
    userId: string,
    publicationId: string,
  ): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const userRole = await this.getUserRoleInCommunity(
      userId,
      publication.getCommunityId.getValue(),
    );

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can edit
    const authorId = publication.getAuthorId.getValue();
    return authorId === userId;
  }

  /**
   * Check if user can delete a publication
   */
  async canDeletePublication(
    userId: string,
    publicationId: string,
  ): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const userRole = await this.getUserRoleInCommunity(
      userId,
      publication.getCommunityId.getValue(),
    );

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can delete
    const authorId = publication.getAuthorId.getValue();
    return authorId === userId;
  }

  /**
   * Check if user can edit a comment
   */
  async canEditComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can edit
    return comment.getAuthorId.getValue() === userId;
  }

  /**
   * Check if user can delete a comment
   */
  async canDeleteComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can delete
    return comment.getAuthorId.getValue() === userId;
  }
}
