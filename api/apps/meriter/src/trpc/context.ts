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
  const jwt = req.cookies?.jwt;

  let user: AuthenticatedUser | null = null;

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

