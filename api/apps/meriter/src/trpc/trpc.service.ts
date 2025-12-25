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
import { createContext } from './context';
import { appRouter } from './router';
import type { AppRouter } from './router';

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
    private inviteService: InviteService,
    private quotaUsageService: QuotaUsageService,
    private permissionService: PermissionService,
    private userEnrichmentService: UserEnrichmentService,
    private communityEnrichmentService: CommunityEnrichmentService,
    private permissionsHelperService: PermissionsHelperService,
    private communityFeedService: CommunityFeedService,
    private authService: AuthService,
    private quotaResetService: QuotaResetService,
    private userSettingsService: UserSettingsService,
    private voteCommentResolverService: VoteCommentResolverService,
    private commentEnrichmentService: CommentEnrichmentService,
    @InjectConnection() private connection: Connection,
    private configService: ConfigService<AppConfig>,
    private cookieManager: CookieManager,
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
      inviteService: this.inviteService,
      quotaUsageService: this.quotaUsageService,
      permissionService: this.permissionService,
      userEnrichmentService: this.userEnrichmentService,
      communityEnrichmentService: this.communityEnrichmentService,
      permissionsHelperService: this.permissionsHelperService,
      communityFeedService: this.communityFeedService,
      authService: this.authService,
      quotaResetService: this.quotaResetService,
      userSettingsService: this.userSettingsService,
      voteCommentResolverService: this.voteCommentResolverService,
      commentEnrichmentService: this.commentEnrichmentService,
      connection: this.connection,
      configService: this.configService,
      cookieManager: this.cookieManager,
    });
  }
}

