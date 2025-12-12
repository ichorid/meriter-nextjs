import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';
import { PollService } from './poll.service';

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
    private pollService: PollService,
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

    // Special handling for marathon-of-good and future-vision communities
    const isSpecialCommunity =
      community.typeTag === 'marathon-of-good' ||
      community.typeTag === 'future-vision';
    if (isSpecialCommunity && userRole === 'participant') {
      return true;
    }

    const rules = community.postingRules;
    if (!rules) {
      // If no rules configured, deny by default
      return false;
    }

    // Check if role is allowed
    if (!userRole || !rules.allowedRoles.includes(userRole)) return false;

    // Additional checks from configuration
    if (rules.requiresTeamMembership) {
      // Check if user has a role in any team-type community
      const hasTeamMembership = await this.userHasTeamMembership(userId);
      if (!hasTeamMembership) return false;
    }
    if (rules.onlyTeamLead && userRole !== 'lead') return false;

    return true;
  }

  /**
   * Check if user can create polls in a community
   * Uses postingRules from community configuration (same as publications)
   */
  async canCreatePoll(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    // Special handling for marathon-of-good and future-vision communities
    const isSpecialCommunity =
      community.typeTag === 'marathon-of-good' ||
      community.typeTag === 'future-vision';
    if (isSpecialCommunity && userRole === 'participant') {
      return true;
    }

    // Allow participants in team groups to create polls
    // This overrides postingRules if they exist and are restrictive
    if (community.typeTag === 'team' && ['participant', 'lead'].includes(userRole)) {
      return true;
    }

    const rules = community.postingRules;
    if (!rules) {
      // If no rules configured, deny by default
      return false;
    }

    // Check if role is allowed
    if (!userRole || !rules.allowedRoles.includes(userRole)) return false;

    // Additional checks from configuration
    if (rules.requiresTeamMembership) {
      // Check if user has a role in any team-type community
      const hasTeamMembership = await this.userHasTeamMembership(userId);
      if (!hasTeamMembership) return false;
    }
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
    const community = await this.communityService.getCommunity(communityId);
    return community?.typeTag === 'team';
  }

  /**
   * Check if user is a team member of the team community
   */
  private async isUserTeamMember(userId: string, teamCommunityId: string): Promise<boolean> {
    const userRole = await this.getUserRoleInCommunity(userId, teamCommunityId);
    // User is a team member if they have any role in the team community
    return userRole !== null;
  }

  /**
   * Check if user has membership in any team-type community
   */
  private async userHasTeamMembership(userId: string): Promise<boolean> {
    // Get all team-type communities where user has a role
    const userRoles = await this.userCommunityRoleService.getUserRoles(userId);
    if (!userRoles || userRoles.length === 0) return false;

    // Check if any of the communities are team-type
    for (const role of userRoles) {
      const community = await this.communityService.getCommunity(role.communityId);
      if (community?.typeTag === 'team') {
        return true;
      }
    }
    return false;
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
    if (!userRole || !rules.allowedRoles.includes(userRole)) return false;

    // Check if voting for own post is allowed
    // Superadmin still cannot vote for own posts unless explicitly allowed
    if (authorId === userId && !rules.canVoteForOwnPosts) {
      return false;
    }

    // Superadmin can vote for anything except own posts (already checked above)
    if (userRole === 'superadmin') return true;

    // For viewers: Only allow voting in marathon-of-good communities
    // Check this before other role checks to ensure proper restriction
    if (userRole === 'viewer') {
      if (community.typeTag !== 'marathon-of-good') {
        return false; // Viewers can only vote in marathon-of-good communities
      }
      // Viewers can vote in marathon-of-good (already checked own posts above)
      return true;
    }

    // For participants: Check team-based restrictions
    if (userRole === 'participant') {
      // Check if voter and author are in the same team-type community
      const voterRoles = await this.userCommunityRoleService.getUserRoles(userId);
      const authorRoles = await this.userCommunityRoleService.getUserRoles(authorId);
      
      // Find common team-type communities
      const voterTeamCommunities = new Set<string>();
      const authorTeamCommunities = new Set<string>();
      
      for (const role of voterRoles || []) {
        const comm = await this.communityService.getCommunity(role.communityId);
        if (comm?.typeTag === 'team') {
          voterTeamCommunities.add(role.communityId);
        }
      }
      
      for (const role of authorRoles || []) {
        const comm = await this.communityService.getCommunity(role.communityId);
        if (comm?.typeTag === 'team') {
          authorTeamCommunities.add(role.communityId);
        }
      }
      
      // Check if they share a team community
      const sharedTeamCommunities = [...voterTeamCommunities].filter(id => authorTeamCommunities.has(id));
      
      if (sharedTeamCommunities.length > 0) {
        const authorRole = await this.getUserRoleInCommunity(
          authorId,
          communityId,
        );
        if (authorRole === 'lead') {
          return false; // Cannot vote for lead from same team
        }
      }
    }

    // For leads: Allow voting except for own posts (already checked above)
    // For other roles: Allow voting if they passed the allowedRoles check
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

    return userRole ? rules.allowedRoles.includes(userRole) : false;
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

    // Special handling for Team groups: viewers cannot see them (R:n)
    if (community.typeTag === 'team' && userRole === 'viewer') {
      return false;
    }

    const rules = community.visibilityRules;
    if (!rules) {
      // Fallback: if no rules configured, check if user is member (backward compatibility)
      // For Team groups without rules, exclude viewers
      if (community.typeTag === 'team' && userRole === 'viewer') {
        return false;
      }
      return (
        community.members?.includes(userId) ||
        false
      );
    }

    // Check if hidden
    if (rules.isHidden) return false;

    // Check if role can see
    if (!userRole || !rules.visibleToRoles.includes(userRole)) return false;

    // Check team-only access
    if (rules.teamOnly) {
      const hasTeamMembership = await this.userHasTeamMembership(userId);
      if (!hasTeamMembership) return false;
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

    const authorId = publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin can edit any publication (no restrictions)
    if (userRole === 'superadmin') return true;

    // Lead can edit publications in their community (no restrictions)
    if (userRole === 'lead') return true;

    // For authors: check vote count and time window
    if (authorId === userId) {
      // Check if publication has any votes
      const metrics = publication.getMetrics;
      const metricsSnapshot = metrics.toSnapshot();
      const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
      if (totalVotes > 0) {
        return false; // Cannot edit if votes exist
      }

      // Check time window from community settings
      const community = await this.communityService.getCommunity(communityId);
      if (!community) return false;

      const editWindowDays = community.settings?.editWindowDays ?? 7;
      if (editWindowDays === 0) {
        // 0 means no time limit
        return true;
      }

      const snapshot = publication.toSnapshot();
      const createdAt = snapshot.createdAt instanceof Date 
        ? snapshot.createdAt 
        : new Date(snapshot.createdAt);
      const now = new Date();
      // Calculate days since creation using floor to be consistent with day boundaries
      // If created 8 days ago at any time, it's been more than 7 days
      const millisecondsSinceCreation = now.getTime() - createdAt.getTime();
      const daysSinceCreation = Math.floor(millisecondsSinceCreation / (1000 * 60 * 60 * 24));

      // editWindowDays of 7 means can edit for 7 days (days 0-6), not including day 7+
      // So if daysSinceCreation is 8 and editWindowDays is 7, should return false
      // Use < instead of <= to be strict: if it's been 7 full days, that's the limit
      return daysSinceCreation < editWindowDays;
    }

    return false;
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

    const communityId = publication.getCommunityId.getValue();
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can delete
    const authorId = publication.getAuthorId.getValue();
    if (authorId === userId) return true;

    // Lead can delete publications in their community
    if (userRole === 'lead') return true;

    return false;
  }

  /**
   * Check if user can edit a comment
   */
  async canEditComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const authorId = comment.getAuthorId.getValue();
    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin can edit any comment (no restrictions)
    if (userRole === 'superadmin') return true;

    // Lead can edit comments in their community (no restrictions)
    if (userRole === 'lead') return true;

    // For authors: check vote count and time window
    if (authorId === userId) {
      // Check if comment has any votes
      const metrics = comment.getMetrics;
      const metricsSnapshot = metrics.toSnapshot();
      const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
      if (totalVotes > 0) {
        return false; // Cannot edit if votes exist
      }

      // Check time window from community settings
      const community = await this.communityService.getCommunity(communityId);
      if (!community) return false;

      const editWindowDays = community.settings?.editWindowDays ?? 7;
      if (editWindowDays === 0) {
        // 0 means no time limit
        return true;
      }

      const createdAt = comment.toSnapshot().createdAt;
      const now = new Date();
      const daysSinceCreation = Math.floor(
        (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceCreation <= editWindowDays;
    }

    return false;
  }

  /**
   * Check if user can delete a comment
   * Authors cannot delete their own comments - only admins (superadmin/lead) can delete
   */
  async canDeleteComment(userId: string, commentId: string): Promise<boolean> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) return false;

    const communityId =
      await this.commentService.resolveCommentCommunityId(commentId);
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Authors cannot delete their own comments
    // Removed: if (authorId === userId) return true;

    // Lead can delete comments in their community
    if (userRole === 'lead') return true;

    return false;
  }

  /**
   * Check if user can edit a poll
   */
  async canEditPoll(userId: string, pollId: string): Promise<boolean> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) return false;

    // Author can edit their own polls
    const authorId = poll.getAuthorId;
    if (authorId === userId) return true;

    // If not author, check if user is superadmin or lead
    const communityId = poll.getCommunityId;
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin can edit any poll
    if (userRole === 'superadmin') return true;

    // Lead can edit polls in their community
    if (userRole === 'lead') return true;

    return false;
  }

  /**
   * Check if user can delete a poll
   */
  async canDeletePoll(userId: string, pollId: string): Promise<boolean> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) return false;

    const communityId = poll.getCommunityId;
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === 'superadmin') return true;

    // Author can delete
    const authorId = poll.getAuthorId;
    if (authorId === userId) return true;

    // Lead can delete polls in their community
    if (userRole === 'lead') return true;

    return false;
  }
}
