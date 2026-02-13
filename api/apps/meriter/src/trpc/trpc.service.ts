import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
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
import { CategoryService } from '../domain/services/category.service';
import { AboutService } from '../domain/services/about.service';
import { VoteFactorService } from '../domain/services/vote-factor.service';
import { TappalkaService } from '../domain/services/tappalka.service';
import { InvestmentService } from '../domain/services/investment.service';
import { PostClosingService } from '../domain/services/post-closing.service';
import { MeritResolverService } from '../domain/services/merit-resolver.service';
import { TeamJoinRequestService } from '../domain/services/team-join-request.service';
import { TeamInvitationService } from '../domain/services/team-invitation.service';
import { createContext } from './context';
import { appRouter } from './router';
import type { AppRouter } from './router';
import { JwtVerificationService } from '../common/services/authentication.service';

@Injectable()
export class TrpcService {
  constructor(
    private userService: UserService,
    private communityService: CommunityService,
    private userCommunityRoleService: UserCommunityRoleService,
    private walletService: WalletService,
    private publicationService: PublicationService,
    private commentService: CommentService,
    private voteService: VoteService,
    private pollService: PollService,
    private pollCastService: PollCastService,
    private notificationService: NotificationService,
    private quotaUsageService: QuotaUsageService,
    private permissionService: PermissionService,
    private favoriteService: FavoriteService,
    private userEnrichmentService: UserEnrichmentService,
    private communityEnrichmentService: CommunityEnrichmentService,
    private permissionsHelperService: PermissionsHelperService,
    private communityFeedService: CommunityFeedService,
    private authService: AuthProviderService,
    private quotaResetService: QuotaResetService,
    private userSettingsService: UserSettingsService,
    private voteCommentResolverService: VoteCommentResolverService,
    private commentEnrichmentService: CommentEnrichmentService,
    private uploadsService: UploadsService,
    private categoryService: CategoryService,
    private aboutService: AboutService,
    private voteFactorService: VoteFactorService,
    private tappalkaService: TappalkaService,
    private investmentService: InvestmentService,
    private postClosingService: PostClosingService,
    private meritResolverService: MeritResolverService,
    private teamJoinRequestService: TeamJoinRequestService,
    private teamInvitationService: TeamInvitationService,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<AppConfig>,
    private cookieManager: CookieManager,
    private authenticationService: JwtVerificationService,
  ) {}

  getRouter(): AppRouter {
    return appRouter;
  }

  async createContext(req: any, res: any) {
    return createContext({
      req,
      res,
      userService: this.userService,
      communityService: this.communityService,
      userCommunityRoleService: this.userCommunityRoleService,
      walletService: this.walletService,
      publicationService: this.publicationService,
      commentService: this.commentService,
      voteService: this.voteService,
      pollService: this.pollService,
      pollCastService: this.pollCastService,
      notificationService: this.notificationService,
      quotaUsageService: this.quotaUsageService,
      permissionService: this.permissionService,
      favoriteService: this.favoriteService,
      userEnrichmentService: this.userEnrichmentService,
      communityEnrichmentService: this.communityEnrichmentService,
      permissionsHelperService: this.permissionsHelperService,
      communityFeedService: this.communityFeedService,
      authService: this.authService,
      quotaResetService: this.quotaResetService,
      userSettingsService: this.userSettingsService,
      voteCommentResolverService: this.voteCommentResolverService,
      commentEnrichmentService: this.commentEnrichmentService,
      uploadsService: this.uploadsService,
      categoryService: this.categoryService,
      aboutService: this.aboutService,
      voteFactorService: this.voteFactorService,
      tappalkaService: this.tappalkaService,
      investmentService: this.investmentService,
      postClosingService: this.postClosingService,
      meritResolverService: this.meritResolverService,
      teamJoinRequestService: this.teamJoinRequestService,
      teamInvitationService: this.teamInvitationService,
      connection: this.connection,
      configService: this.configService,
      cookieManager: this.cookieManager,
      authenticationService: this.authenticationService,
    });
  }
}

