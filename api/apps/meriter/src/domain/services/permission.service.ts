import { Injectable, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { CommentService } from './comment.service';
import { PollService } from './poll.service';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD, COMMUNITY_ROLE_PARTICIPANT, COMMUNITY_ROLE_VIEWER } from '../common/constants/roles.constants';

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
   * Uses postingRules from community configuration
   */
  async canCreatePublication(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin always can
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    // Participants can always post by default (unless explicitly restricted)
    if (userRole === COMMUNITY_ROLE_PARTICIPANT) {
      const rules = this.communityService.getEffectivePostingRules(community);
      
      // Check explicit restrictions that would deny participants
      if (rules.onlyTeamLead) {
        // If only team leads can post, participants cannot
        return false;
      }
      
      // Check additional restrictions
      if (rules.requiresTeamMembership) {
        const hasTeamMembership = await this.userHasTeamMembership(userId);
        if (!hasTeamMembership) return false;
      }
      
      // For custom communities, check if participant is in allowedRoles
      // Special communities (marathon-of-good, future-vision, support, team) allow participants regardless
      const isSpecialCommunity = community.typeTag === 'marathon-of-good' 
        || community.typeTag === 'future-vision' 
        || community.typeTag === 'support'
        || community.typeTag === 'team';
      
      if (!isSpecialCommunity) {
        // For custom communities, check allowedRoles
        if (!rules.allowedRoles.includes(COMMUNITY_ROLE_PARTICIPANT)) {
          return false;
        }
      }
      
      // Participants can post by default for special communities, or if allowedRoles includes participant
      return true;
    }

    // For other roles (lead, viewer), check effective rules
    const rules = this.communityService.getEffectivePostingRules(community);

    // Check if role is allowed
    if (!userRole || !rules.allowedRoles.includes(userRole)) return false;

    // Additional checks from configuration
    if (rules.requiresTeamMembership) {
      // Check if user has a role in any team-type community
      const hasTeamMembership = await this.userHasTeamMembership(userId);
      if (!hasTeamMembership) return false;
    }
    if (rules.onlyTeamLead && userRole !== COMMUNITY_ROLE_LEAD) return false;

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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    // Participants can always create polls by default (unless explicitly restricted)
    if (userRole === COMMUNITY_ROLE_PARTICIPANT) {
      const rules = this.communityService.getEffectivePostingRules(community);
      
      // Check explicit restrictions that would deny participants
      if (rules.onlyTeamLead) {
        // If only team leads can create polls, participants cannot
        return false;
      }
      
      // Check additional restrictions
      if (rules.requiresTeamMembership) {
        const hasTeamMembership = await this.userHasTeamMembership(userId);
        if (!hasTeamMembership) return false;
      }
      
      // For custom communities, check if participant is in allowedRoles
      // Special communities (marathon-of-good, future-vision, support, team) allow participants regardless
      const isSpecialCommunity = community.typeTag === 'marathon-of-good' 
        || community.typeTag === 'future-vision' 
        || community.typeTag === 'support'
        || community.typeTag === 'team';
      
      if (!isSpecialCommunity) {
        // For custom communities, check allowedRoles
        if (!rules.allowedRoles.includes(COMMUNITY_ROLE_PARTICIPANT)) {
          return false;
        }
      }
      
      // Participants can create polls by default for special communities, or if allowedRoles includes participant
      return true;
    }

    // For other roles (lead, viewer), check effective rules
    const rules = this.communityService.getEffectivePostingRules(community);

    // Check if role is allowed
    if (!userRole || !rules.allowedRoles.includes(userRole)) return false;

    // Additional checks from configuration
    if (rules.requiresTeamMembership) {
      // Check if user has a role in any team-type community
      const hasTeamMembership = await this.userHasTeamMembership(userId);
      if (!hasTeamMembership) return false;
    }
    if (rules.onlyTeamLead && userRole !== COMMUNITY_ROLE_LEAD) return false;

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
    this.logger.log(`[canVote] START: userId=${userId}, publicationId=${publicationId}`);

    // STEP 1: Get user and check superadmin status FIRST
    const user = await this.userService.getUserById(userId);
    if (!user) {
      this.logger.warn(`[canVote] User ${userId} not found`);
      return false;
    }

    const isSuperadmin = user.globalRole === GLOBAL_ROLE_SUPERADMIN;
    this.logger.log(`[canVote] User: id=${userId}, globalRole=${user.globalRole}, isSuperadmin=${isSuperadmin}`);

    // STEP 2: Get publication
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      this.logger.warn(`[canVote] Publication ${publicationId} not found`);
      return false;
    }

    const communityId = publication.getCommunityId.getValue();
    const authorId = publication.getAuthorId.getValue();
    this.logger.log(`[canVote] Publication: communityId=${communityId}, authorId=${authorId}`);

    // STEP 3: SUPERADMIN CHECK - If superadmin, allow voting on all posts EXCEPT own posts
    if (isSuperadmin) {
      this.logger.log(`[canVote] SUPERADMIN DETECTED`);
      if (authorId === userId) {
        this.logger.log(`[canVote] Superadmin DENIED: cannot vote for own post`);
        return false;
      }
      this.logger.log(`[canVote] Superadmin ALLOWED: voting for another user's post`);
      return true;
    }

    // STEP 4: Regular user logic (non-superadmin)
    this.logger.log(`[canVote] Regular user check: userId=${userId}`);

    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      this.logger.warn(`[canVote] Community ${communityId} not found`);
      return false;
    }

    this.logger.log(`[canVote] Community: id=${communityId}, typeTag=${community.typeTag}, name=${community.name}`);

    const userRole = await this.getUserRoleInCommunity(userId, communityId);
    this.logger.log(`[canVote] User role in community: ${userRole}`);

    // Check if publication is in a team community
    const isTeamCommunity = await this.isPublicationInTeamCommunity(publicationId);
    this.logger.log(`[canVote] Is team community: ${isTeamCommunity}`);

    if (isTeamCommunity) {
      // Inside Team Communities: Only team members can vote, and they can vote for each other but not themselves
      const isTeamMember = await this.isUserTeamMember(userId, communityId);
      if (!isTeamMember) {
        this.logger.log(`[canVote] DENIED: Not a team member`);
        return false;
      }
      
      // Team members can vote for each other, but not themselves
      if (authorId === userId) {
        this.logger.log(`[canVote] DENIED: Cannot vote for own post in team community`);
        return false;
      }
      
      this.logger.log(`[canVote] ALLOWED: Team member voting for another team member`);
      return true;
    }

    // Outside Team Communities: Apply regular voting rules
    const rules = this.communityService.getEffectiveVotingRules(community);

    // Special handling for support communities: participants can always vote
    // This matches the posting rules behavior where participants can post in support communities
    const isSupportCommunityParticipant = community.typeTag === 'support' && userRole === COMMUNITY_ROLE_PARTICIPANT;
    this.logger.log(`[canVote] Support community check: typeTag="${community.typeTag}", userRole="${userRole}", COMMUNITY_ROLE_PARTICIPANT="${COMMUNITY_ROLE_PARTICIPANT}", isSupportCommunityParticipant=${isSupportCommunityParticipant}`);
    
    // Check if role is allowed (skip for support community participants)
    if (!isSupportCommunityParticipant) {
      if (!userRole || !rules.allowedRoles.includes(userRole)) {
        this.logger.log(`[canVote] DENIED: Role ${userRole} not in allowedRoles [${rules.allowedRoles.join(', ')}]`);
        return false;
      }
    } else {
      this.logger.log(`[canVote] ALLOWED: Participant voting in support community (special handling, skipping allowedRoles check)`);
    }

    // Check if voting for own post is allowed
    if (authorId === userId && !rules.canVoteForOwnPosts) {
      // Exception: future-vision allows self-voting for participants, leads, and superadmins
      if (community.typeTag === 'future-vision' && 
          (userRole === COMMUNITY_ROLE_PARTICIPANT || userRole === COMMUNITY_ROLE_LEAD || userRole === COMMUNITY_ROLE_SUPERADMIN)) {
        this.logger.log(`[canVote] ALLOWED: Future-vision allows self-voting`);
        return true;
      }
      this.logger.log(`[canVote] DENIED: Cannot vote for own post (rules disallow)`);
      return false;
    }

    // For viewers: Only allow voting in marathon-of-good communities
    if (userRole === COMMUNITY_ROLE_VIEWER) {
      if (community.typeTag !== 'marathon-of-good') {
        this.logger.log(`[canVote] DENIED: Viewers can only vote in marathon-of-good communities`);
        return false;
      }
      this.logger.log(`[canVote] ALLOWED: Viewer voting in marathon-of-good`);
      return true;
    }

    // For participants: Check team-based restrictions
    // Skip team restrictions for support communities (participants can vote freely)
    if (userRole === COMMUNITY_ROLE_PARTICIPANT && community.typeTag !== 'support') {
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
        if (authorRole === COMMUNITY_ROLE_LEAD) {
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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(
      publication.getCommunityId.getValue(),
    );
    if (!community) return false;

    // Use votingRules for comments (can be extended with separate commentRules)
    const rules = this.communityService.getEffectiveVotingRules(community);

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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    const community = await this.communityService.getCommunity(communityId);
    if (!community) return false;

    // Special handling for Team groups: viewers cannot see them (R:n)
    if (community.typeTag === 'team' && userRole === COMMUNITY_ROLE_VIEWER) {
      return false;
    }

    const rules = this.communityService.getEffectiveVisibilityRules(community);

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
    if (!publication) {
      return false;
    }

    const authorId = publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    if (userRole === COMMUNITY_ROLE_SUPERADMIN) {
      return true;
    }

    if (userRole === COMMUNITY_ROLE_LEAD) {
      return true;
    }

    // For authors: check vote count and time window
    // Normalize IDs to strings for comparison
    const normalizedAuthorId = String(authorId).trim();
    const normalizedUserId = String(userId).trim();
    const isAuthor = normalizedAuthorId === normalizedUserId;
    
    if (isAuthor) {
      // Check if publication has any votes or comments
      const metrics = publication.getMetrics;
      const metricsSnapshot = metrics.toSnapshot();
      const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
      const commentCount = metricsSnapshot.commentCount || 0;
      
      if (totalVotes > 0) {
        return false; // Cannot edit if votes exist
      }
      
      if (commentCount > 0) {
        return false; // Cannot edit if comments exist
      }

      // Check time window from community settings
      const community = await this.communityService.getCommunity(communityId);
      if (!community) {
        return false;
      }

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
      const canEdit = daysSinceCreation < editWindowDays;
      
      return canEdit;
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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    // Lead can delete publications in their community
    if (userRole === COMMUNITY_ROLE_LEAD) return true;

    // Author can delete only if no votes and no comments
    const authorId = publication.getAuthorId.getValue();
    if (authorId === userId) {
      // Check if publication has any votes or comments
      const metrics = publication.getMetrics;
      const metricsSnapshot = metrics.toSnapshot();
      const totalVotes = metricsSnapshot.upvotes + metricsSnapshot.downvotes;
      const commentCount = metricsSnapshot.commentCount || 0;
      
      if (totalVotes > 0 || commentCount > 0) {
        return false; // Cannot delete if votes or comments exist
      }
      return true;
    }

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

    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    if (userRole === COMMUNITY_ROLE_LEAD) return true;

    // For authors: check vote count and time window
    // Normalize IDs to strings for comparison
    const normalizedAuthorId = String(authorId).trim();
    const normalizedUserId = String(userId).trim();
    if (normalizedAuthorId === normalizedUserId) {
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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    // Authors cannot delete their own comments
    // Removed: if (authorId === userId) return true;

    // Lead can delete comments in their community
    if (userRole === COMMUNITY_ROLE_LEAD) return true;

    return false;
  }

  /**
   * Check if user can edit a poll
   */
  async canEditPoll(userId: string, pollId: string): Promise<boolean> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) return false;

    const communityId = poll.getCommunityId;
    const userRole = await this.getUserRoleInCommunity(userId, communityId);

    // Superadmin can edit any poll
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    // Lead can edit polls in their community
    if (userRole === COMMUNITY_ROLE_LEAD) return true;

    // Author can edit their own polls
    const authorId = poll.getAuthorId;
    if (authorId === userId) return true;

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
    if (userRole === COMMUNITY_ROLE_SUPERADMIN) return true;

    // Lead can delete polls in their community
    if (userRole === COMMUNITY_ROLE_LEAD) return true;

    // Author can delete
    const authorId = poll.getAuthorId;
    if (authorId === userId) return true;

    return false;
  }
}
