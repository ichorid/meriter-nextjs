import { inferAsyncReturnType } from '@trpc/server';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
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
import { FavoriteService } from '../domain/services/favorite.service';
import { UserEnrichmentService } from '../api-v1/common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../api-v1/common/services/community-enrichment.service';
import { PermissionsHelperService } from '../api-v1/common/services/permissions-helper.service';
import { CommunityFeedService } from '../domain/services/community-feed.service';
import { AuthProviderService } from '../api-v1/auth/auth.service';
import { QuotaResetService } from '../domain/services/quota-reset.service';
import { UserSettingsService } from '../domain/services/user-settings.service';
import { VoteCommentResolverService } from '../api-v1/common/services/vote-comment-resolver.service';
import { CommentEnrichmentService } from '../api-v1/common/services/comment-enrichment.service';
import { CookieManager } from '../api-v1/common/utils/cookie-manager.util';
import { UploadsService } from '../api-v1/uploads/uploads.service';
import { Connection } from 'mongoose';
import { JwtVerificationService } from '../common/services/authentication.service';
import { CategoryService } from '../domain/services/category.service';
import { AboutService } from '../domain/services/about.service';
import { VoteFactorService } from '../domain/services/vote-factor.service';
import { TappalkaService } from '../domain/services/tappalka.service';

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
  favoriteService: FavoriteService;
  userEnrichmentService: UserEnrichmentService;
  communityEnrichmentService: CommunityEnrichmentService;
  permissionsHelperService: PermissionsHelperService;
  communityFeedService: CommunityFeedService;
  authService: AuthProviderService;
  quotaResetService: QuotaResetService;
  userSettingsService: UserSettingsService;
  voteCommentResolverService: VoteCommentResolverService;
  commentEnrichmentService: CommentEnrichmentService;
  uploadsService: UploadsService;
  categoryService: CategoryService;
  aboutService: AboutService;
  voteFactorService: VoteFactorService;
  tappalkaService: TappalkaService;
  connection: Connection;
  configService: ConfigService<AppConfig>;
  cookieManager: CookieManager;
  authenticationService: JwtVerificationService;
}

/**
 * Creates tRPC context with authenticated user from JWT cookie
 * Uses JwtVerificationService for consistent authentication logic with UserGuard
 * 
 * In test environments, guards (like AllowAllGuard) may set req.user directly.
 * JwtVerificationService checks req.user first, then test globals, then JWT cookie authentication.
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
    favoriteService,
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
    categoryService,
    aboutService,
    voteFactorService,
    tappalkaService,
    connection,
    configService,
    cookieManager,
    pollCastService,
    authenticationService,
  } = opts;

  const logger = new Logger('tRPC-Context');
  const path = req.url || req.path || 'unknown';
  const method = req.method || 'unknown';

  // DEBUG: Log request details
  logger.debug(
    `[AUTH-DEBUG] tRPC context creation: method=${method}, path=${path}, host=${req.headers?.host || 'unknown'}`
  );

  // DEBUG: Log cookie parser status
  const hasCookies = !!req.cookies;
  const cookieHeader = req.headers?.cookie;
  const jwtCookie = req.cookies?.jwt;
  const cookieKeys = req.cookies ? Object.keys(req.cookies) : [];

  logger.debug(
    `[AUTH-DEBUG] Cookie parser status: hasCookies=${hasCookies}, cookieHeader exists=${!!cookieHeader}, cookieHeader length=${cookieHeader?.length || 0}, cookieKeys=[${cookieKeys.join(', ')}]`
  );

  if (jwtCookie) {
    logger.debug(
      `[AUTH-DEBUG] JWT cookie found: length=${jwtCookie.length}, first 30 chars: ${jwtCookie.substring(0, 30)}..., last 10 chars: ...${jwtCookie.substring(jwtCookie.length - 10)}`
    );
  } else {
    logger.warn(
      `[AUTH-DEBUG] JWT cookie NOT found. req.user exists: ${!!req.user}, req.user.id: ${req.user?.id || 'none'}`
    );
  }

  // DEBUG: Log request headers that might affect cookie parsing
  logger.debug(
    `[AUTH-DEBUG] Request headers: user-agent=${req.headers?.['user-agent']?.substring(0, 50) || 'none'}, referer=${req.headers?.referer || 'none'}, origin=${req.headers?.origin || 'none'}`
  );

  // Authenticate using JwtVerificationService (supports req.user, test globals, and JWT)
  const authResult = await authenticationService.authenticateFromRequest({
    req,
    allowTestMode: true, // Allow test globals for tRPC (guards aren't applied to Express middleware)
  });

  // DEBUG: Log authentication result
  if (authResult.user) {
    logger.debug(
      `[AUTH-DEBUG] Authentication SUCCESS: userId=${authResult.user.id}, username=${authResult.user.username || 'none'}, authProvider=${authResult.user.authProvider}`
    );
  } else {
    logger.warn(
      `[AUTH-DEBUG] Authentication FAILED: error=${authResult.error || 'UNKNOWN'}, errorMessage=${authResult.errorMessage || 'none'}`
    );
  }

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
    favoriteService,
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
    categoryService,
    aboutService,
    voteFactorService,
    tappalkaService,
    connection,
    configService,
    cookieManager,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;

