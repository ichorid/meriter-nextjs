import { Injectable, Logger } from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { PermissionContext } from '../models/community/community.schema';
import { PublicationService } from './publication.service';
import { CommentService } from './comment.service';
import { PollService } from './poll.service';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { PermissionService } from './permission.service';

/**
 * PermissionContextService
 * 
 * Service for building permission context from resources and user state.
 * Provides context information needed for permission evaluation.
 */
@Injectable()
export class PermissionContextService {
  private readonly logger = new Logger(PermissionContextService.name);

  constructor(
    @Inject(forwardRef(() => PublicationService))
    private publicationService: PublicationService,
    @Inject(forwardRef(() => CommentService))
    private commentService: CommentService,
    @Inject(forwardRef(() => PollService))
    private pollService: PollService,
    private communityService: CommunityService,
    private userCommunityRoleService: UserCommunityRoleService,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
  ) { }

  /**
   * Build context for a publication resource
   */
  async buildContextForPublication(
    userId: string,
    publicationId: string,
  ): Promise<PermissionContext> {
    const publication = await this.publicationService.getPublication(publicationId);
    if (!publication) {
      return {};
    }

    const communityId = publication.getCommunityId.getValue();
    const authorId = publication.getAuthorId.getValue();

    // Ensure accurate string comparison for IDs
    const authorIdStr = (authorId as any) instanceof Object ? authorId.toString() : String(authorId);
    const userIdStr = (userId as any) instanceof Object ? userId.toString() : String(userId);
    const isAuthor = authorIdStr.trim().toLowerCase() === userIdStr.trim().toLowerCase();

    // console.log(`[DEBUG_CTX] pubId=${publicationId} isAuthor=${isAuthor}`);
    // console.log(`[DEBUG_CTX] authorId: type=${typeof authorId}, val=${authorId}, str=${authorIdStr}`);
    // console.log(`[DEBUG_CTX] userId: type=${typeof userId}, val=${userId}, str=${userIdStr}`);

    this.logger.debug(`[buildContextForPublication] pubId=${publicationId} isAuthor=${isAuthor} (${authorIdStr} vs ${userIdStr})`);

    const community = await this.communityService.getCommunity(communityId);
    const isTeamCommunity = community?.typeTag === 'team';

    // Get metrics
    const metrics = publication.getMetrics;
    const metricsSnapshot = metrics.toSnapshot();
    const hasVotes = (metricsSnapshot.upvotes || 0) + (metricsSnapshot.downvotes || 0) > 0;
    const hasComments = (metricsSnapshot.commentCount || 0) > 0;

    // Calculate days since creation
    const snapshot = publication.toSnapshot();
    const createdAt = snapshot.createdAt instanceof Date
      ? snapshot.createdAt
      : new Date(snapshot.createdAt);
    const now = new Date();
    const minutesSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60)
    );

    // Get author role
    const authorRole = await this.permissionService.getUserRoleInCommunity(
      authorId,
      communityId,
    );

    // Check team membership
    const isTeamMember = isTeamCommunity
      ? await this.isUserTeamMember(userId, communityId)
      : false;

    const hasTeamMembership = await this.userHasTeamMembership(userId);

    // For voting context: check shared team communities
    const sharedTeamCommunities = await this.getSharedTeamCommunities(userId, authorId);

    return {
      resourceId: publicationId,
      authorId,
      isAuthor,
      isTeamMember,
      hasTeamMembership,
      isTeamCommunity,
      authorRole,
      sharedTeamCommunities,
      hasVotes,
      hasComments,
      minutesSinceCreation,
    };
  }

  /**
   * Build context for a comment resource
   */
  async buildContextForComment(
    userId: string,
    commentId: string,
  ): Promise<PermissionContext> {
    const comment = await this.commentService.getComment(commentId);
    if (!comment) {
      return {};
    }

    const authorId = comment.getAuthorId.getValue();

    // Ensure accurate string comparison for IDs
    const authorIdStr = String(authorId);
    const userIdStr = String(userId);
    const isAuthor = authorIdStr.trim().toLowerCase() === userIdStr.trim().toLowerCase();

    const communityId = await this.commentService.resolveCommentCommunityId(commentId);
    const community = await this.communityService.getCommunity(communityId);
    const isTeamCommunity = community?.typeTag === 'team';

    // Get metrics
    const metrics = comment.getMetrics;
    const metricsSnapshot = metrics.toSnapshot();
    const hasVotes = (metricsSnapshot.upvotes || 0) + (metricsSnapshot.downvotes || 0) > 0;

    // Comment edit window is not used; keep timestamps out of context for comments.
    const createdAt = comment.toSnapshot().createdAt;
    const now = new Date();
    void createdAt;
    void now;

    // Get author role
    const authorRole = await this.permissionService.getUserRoleInCommunity(
      authorId,
      communityId,
    );

    // Check team membership
    const isTeamMember = isTeamCommunity
      ? await this.isUserTeamMember(userId, communityId)
      : false;

    const hasTeamMembership = await this.userHasTeamMembership(userId);

    return {
      resourceId: commentId,
      authorId,
      isAuthor,
      isTeamMember,
      hasTeamMembership,
      isTeamCommunity,
      authorRole,
      hasVotes,
    };
  }

  /**
   * Build context for a poll resource
   */
  async buildContextForPoll(
    userId: string,
    pollId: string,
  ): Promise<PermissionContext> {
    const poll = await this.pollService.getPoll(pollId);
    if (!poll) {
      return {};
    }

    const communityId = poll.getCommunityId;
    const authorId = poll.getAuthorId;

    // Ensure accurate string comparison for IDs
    const authorIdStr = String(authorId);
    const userIdStr = String(userId);
    const isAuthor = authorIdStr.trim().toLowerCase() === userIdStr.trim().toLowerCase();

    const community = await this.communityService.getCommunity(communityId);
    const isTeamCommunity = community?.typeTag === 'team';

    // Get author role
    const authorRole = await this.permissionService.getUserRoleInCommunity(
      authorId,
      communityId,
    );

    // Check team membership
    const isTeamMember = isTeamCommunity
      ? await this.isUserTeamMember(userId, communityId)
      : false;

    const hasTeamMembership = await this.userHasTeamMembership(userId);

    return {
      resourceId: pollId,
      authorId,
      isAuthor,
      isTeamMember,
      hasTeamMembership,
      isTeamCommunity,
      authorRole,
    };
  }

  /**
   * Build context for a community (visibility check)
   */
  async buildContextForCommunity(
    userId: string,
    communityId: string,
  ): Promise<PermissionContext> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return {};
    }

    const isTeamCommunity = community.typeTag === 'team';
    const isTeamMember = isTeamCommunity
      ? await this.isUserTeamMember(userId, communityId)
      : false;

    const hasTeamMembership = await this.userHasTeamMembership(userId);

    return {
      isTeamMember,
      hasTeamMembership,
      isTeamCommunity,
    };
  }

  /**
   * Check if user is a team member of the team community
   */
  private async isUserTeamMember(userId: string, teamCommunityId: string): Promise<boolean> {
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, teamCommunityId);
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
   * Get shared team communities between two users
   */
  private async getSharedTeamCommunities(
    userId1: string,
    userId2: string,
  ): Promise<string[]> {
    const user1Roles = await this.userCommunityRoleService.getUserRoles(userId1);
    const user2Roles = await this.userCommunityRoleService.getUserRoles(userId2);

    const user1TeamCommunities = new Set<string>();
    const user2TeamCommunities = new Set<string>();

    for (const role of user1Roles || []) {
      const comm = await this.communityService.getCommunity(role.communityId);
      if (comm?.typeTag === 'team') {
        user1TeamCommunities.add(role.communityId);
      }
    }

    for (const role of user2Roles || []) {
      const comm = await this.communityService.getCommunity(role.communityId);
      if (comm?.typeTag === 'team') {
        user2TeamCommunities.add(role.communityId);
      }
    }

    // Find shared team communities
    return [...user1TeamCommunities].filter(id => user2TeamCommunities.has(id));
  }
}

