import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';
import { TeamService } from './team.service';

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
    private teamService: TeamService,
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
   * Check if publication is in a team community
   */
  private async isPublicationInTeamCommunity(publicationId: string): Promise<boolean> {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) return false;
    
    const communityId = publication.getCommunityId.getValue();
    const team = await this.teamService.getTeamByCommunityId(communityId);
    return team !== null;
  }

  /**
   * Check if user is a team member of the team that owns the community
   */
  private async isUserTeamMember(userId: string, teamCommunityId: string): Promise<boolean> {
    const team = await this.teamService.getTeamByCommunityId(teamCommunityId);
    if (!team) return false;
    
    return team.leadId === userId || team.participantIds.includes(userId);
  }

  /**
   * Check if user can vote on a publication
   * Uses votingRules from community configuration
   */
  async canVote(userId: string, publicationId: string): Promise<boolean> {
    const publication =
      await this.publicationService.getPublication(publicationId);
    if (!publication) return false;

    const communityId = publication.getCommunityId.getValue();
    const authorId = publication.getAuthorId.getValue();

    const userRole = await this.getUserRoleInCommunity(
      userId,
      communityId,
    );

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    // Check if publication is in a team community
    const isTeamCommunity = await this.isPublicationInTeamCommunity(publicationId);

    if (isTeamCommunity) {
      // Inside Team Communities: Only team members can vote, and they can vote for each other but not themselves
      const isTeamMember = await this.isUserTeamMember(userId, communityId);
      if (!isTeamMember) {
        return false; // Non-team members cannot vote in team communities
      }
      
      // Team members can vote for each other, but not themselves
      if (authorId === userId) {
        return false; // Cannot vote for own post in team community
      }
      
      return true; // Team member voting for another team member
    }

    // Outside Team Communities: Apply regular voting rules
    const rules = community.votingRules;
    if (!rules) {
      // Fallback: if no rules configured, allow everyone (backward compatibility)
      // But still check for own posts
      if (authorId === userId) {
        return false; // Cannot vote for own post by default
      }
      return true;
    }

    // Check if role is allowed
    if (!rules.allowedRoles.includes(userRole as any)) return false;

    // Check if voting for own post is allowed
    // Superadmin still cannot vote for own posts unless explicitly allowed
    if (authorId === userId && !rules.canVoteForOwnPosts) {
      return false;
    }

    // Superadmin can vote for anything except own posts (already checked above)
    if (userRole === 'superadmin') return true;

    // For participants: Check team-based restrictions
    if (userRole === 'participant') {
      const voter = await this.userService.getUserById(userId);
      const author = await this.userService.getUserById(authorId);
      
      // Cannot vote for leads from same team
      if (voter?.teamId && author?.teamId && voter.teamId === author.teamId) {
        const authorRole = await this.getUserRoleInCommunity(
          authorId,
          communityId,
        );
        if (authorRole === 'lead') {
          return false; // Cannot vote for lead from same team
        }
      }
      
      // Cannot vote for participants from marathon/vision communities
      if (community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision') {
        const authorRole = await this.getUserRoleInCommunity(
          authorId,
          communityId,
        );
        if (authorRole === 'participant') {
          return false; // Cannot vote for participants from marathon/vision communities
        }
      }
    }

    // For leads/superadmin: Allow voting except for own posts (already checked above)
    // For viewers: Allow voting except for own posts (already checked above)

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
