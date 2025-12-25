import { inferAsyncReturnType } from '@trpc/server';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
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
import { CookieManager } from '../api-v1/common/utils/cookie-manager.util';
import { UploadsService } from '../api-v1/uploads/uploads.service';
import { Connection } from 'mongoose';
import { AuthenticationService } from '../common/services/authentication.service';

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
  uploadsService: UploadsService;
  connection: Connection;
  configService: ConfigService<AppConfig>;
  cookieManager: CookieManager;
  authenticationService: AuthenticationService;
}

/**
 * Creates tRPC context with authenticated user from JWT cookie
 * Uses AuthenticationService for consistent authentication logic with UserGuard
 * 
 * In test environments, guards (like AllowAllGuard) may set req.user directly.
 * AuthenticationService checks req.user first, then test globals, then JWT cookie authentication.
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
    uploadsService,
    connection,
    configService,
    cookieManager,
    pollCastService,
    authenticationService,
  } = opts;

  // Authenticate using AuthenticationService (supports req.user, test globals, and JWT)
  const authResult = await authenticationService.authenticateFromRequest({
    req,
    allowTestMode: true, // Allow test globals for tRPC (guards aren't applied to Express middleware)
  });

  // Use authenticated user (null if authentication failed - protected procedures will handle it)
  const user = authResult.user;

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
    uploadsService,
    connection,
    configService,
    cookieManager,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

