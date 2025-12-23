import { inferAsyncReturnType } from '@trpc/server';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { UserService } from '../domain/services/user.service';
import { CommunityService } from '../domain/services/community.service';
import { UserCommunityRoleService } from '../domain/services/user-community-role.service';
import { WalletService } from '../domain/services/wallet.service';
import { PublicationService } from '../domain/services/publication.service';
import { CommentService } from '../domain/services/comment.service';
import { VoteService } from '../domain/services/vote.service';
import { PollService } from '../domain/services/poll.service';
import { PollCastService } from '../domain/services/poll-cast.service';
import { NotificationService } from '../domain/services/notification.service';
import { InviteService } from '../domain/services/invite.service';
import { QuotaUsageService } from '../domain/services/quota-usage.service';
import { PermissionService } from '../domain/services/permission.service';
import { UserEnrichmentService } from '../api-v1/common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../api-v1/common/services/community-enrichment.service';
import { PermissionsHelperService } from '../api-v1/common/services/permissions-helper.service';
import { CommunityFeedService } from '../domain/services/community-feed.service';
import { AuthService } from '../api-v1/auth/auth.service';
import { QuotaResetService } from '../domain/services/quota-reset.service';
import { UserSettingsService } from '../domain/services/user-settings.service';
import { VoteCommentResolverService } from '../api-v1/common/services/vote-comment-resolver.service';
import { CommentEnrichmentService } from '../api-v1/common/services/comment-enrichment.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TRPCError } from '@trpc/server';
import { Connection } from 'mongoose';

export interface CreateContextOptions {
  req: any;
  res: any;
  userService: UserService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  walletService: WalletService;
  publicationService: PublicationService;
  commentService: CommentService;
  voteService: VoteService;
  pollService: PollService;
  pollCastService: PollCastService;
  notificationService: NotificationService;
  inviteService: InviteService;
  quotaUsageService: QuotaUsageService;
  permissionService: PermissionService;
  userEnrichmentService: UserEnrichmentService;
  communityEnrichmentService: CommunityEnrichmentService;
  permissionsHelperService: PermissionsHelperService;
  communityFeedService: CommunityFeedService;
  authService: AuthService;
  quotaResetService: QuotaResetService;
  userSettingsService: UserSettingsService;
  voteCommentResolverService: VoteCommentResolverService;
  commentEnrichmentService: CommentEnrichmentService;
  connection: Connection;
  configService: ConfigService;
}

/**
 * Creates tRPC context with authenticated user from JWT cookie
 * Reuses logic from UserGuard for consistency
 * 
 * In test environments, guards (like AllowAllGuard) may set req.user directly.
 * This function checks req.user first before falling back to JWT cookie authentication.
 */
export async function createContext(opts: CreateContextOptions) {
  const {
    req,
    res,
    userService,
    communityService,
    userCommunityRoleService,
    walletService,
    publicationService,
    commentService,
    voteService,
    pollService,
    notificationService,
    inviteService,
    quotaUsageService,
    permissionService,
    userEnrichmentService,
    communityEnrichmentService,
    permissionsHelperService,
    communityFeedService,
    authService,
    quotaResetService,
    userSettingsService,
    voteCommentResolverService,
    commentEnrichmentService,
    connection,
    configService,
    pollCastService,
  } = opts;

  let user: AuthenticatedUser | null = null;

  // Check if req.user is already set by guards (e.g., AllowAllGuard in tests)
  // This allows test guards to bypass JWT authentication
  // Also check for test globals as fallback (when guards aren't applied to TrpcController)
  const testUserId = (global as any).testUserId;
  const testUserGlobalRole = (global as any).testUserGlobalRole;
  
  if (req.user && req.user.id) {
    // User already authenticated by guard - use it directly
    // Enrich with full user data if needed (for tests, req.user might be a mock)
    const dbUser = await userService.getUserById(req.user.id);
    
    if (dbUser) {
      // Use database user for consistency
      user = {
        id: dbUser.id,
        authProvider: dbUser.authProvider,
        authId: dbUser.authId,
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        displayName: dbUser.displayName,
        avatarUrl: dbUser.avatarUrl,
        globalRole: dbUser.globalRole,
      };
    } else {
      // In test scenarios, dbUser might not exist yet - use req.user as fallback
      // Map req.user structure to AuthenticatedUser
      user = {
        id: req.user.id,
        authProvider: req.user.authProvider || 'test',
        authId: req.user.authId || req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl,
        globalRole: req.user.globalRole,
      };
    }
  } else if (testUserId) {
    // Test mode: Use global testUserId (set by tests before making requests)
    // This allows tests to work even when guards aren't applied to TrpcController
    const dbUser = await userService.getUserById(testUserId);
    
    if (dbUser) {
      // Use database user if it exists
      user = {
        id: dbUser.id,
        authProvider: dbUser.authProvider,
        authId: dbUser.authId,
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        displayName: dbUser.displayName,
        avatarUrl: dbUser.avatarUrl,
        globalRole: dbUser.globalRole || testUserGlobalRole,
      };
    } else {
      // Create minimal user object from test globals
      user = {
        id: testUserId,
        authProvider: 'test',
        authId: testUserId,
        username: 'testuser',
        displayName: 'Test User',
        globalRole: testUserGlobalRole,
      };
    }
  } else {
    // No guard-set user - fall back to JWT cookie authentication
    const jwt = req.cookies?.jwt;

    if (jwt) {
      try {
      const jwtSecret = configService.get<string>('jwt.secret');

      if (!jwtSecret || jwtSecret.trim() === '') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'JWT secret not configured',
        });
      }

      const data: any = verify(jwt, jwtSecret);
      const uid = data.uid;

      const dbUser = await userService.getUserById(uid);

      if (!dbUser) {
        // User not found - clear cookie and return null user
        return {
          req,
          res,
          user: null,
          userService,
          communityService,
          userCommunityRoleService,
          walletService,
          publicationService,
          commentService,
          voteService,
          pollService,
          pollCastService,
          notificationService,
          inviteService,
          quotaUsageService,
          permissionService,
          userEnrichmentService,
          communityEnrichmentService,
          permissionsHelperService,
          communityFeedService,
          authService,
          quotaResetService,
          userSettingsService,
          voteCommentResolverService,
          commentEnrichmentService,
          connection,
        };
      }

      user = {
        id: dbUser.id,
        authProvider: dbUser.authProvider,
        authId: dbUser.authId,
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        displayName: dbUser.displayName,
        avatarUrl: dbUser.avatarUrl,
        globalRole: dbUser.globalRole,
      };
      } catch (error) {
        // Invalid JWT - return null user
        // Don't throw here, let protected procedures handle auth
        user = null;
      }
    }
  }

  return {
    req,
    res,
    user,
    userService,
    communityService,
    userCommunityRoleService,
    walletService,
    publicationService,
    commentService,
    voteService,
    pollService,
    pollCastService,
    notificationService,
    inviteService,
    quotaUsageService,
    permissionService,
    userEnrichmentService,
    communityEnrichmentService,
    permissionsHelperService,
    communityFeedService,
    authService,
    quotaResetService,
    userSettingsService,
    voteCommentResolverService,
    commentEnrichmentService,
    connection,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

