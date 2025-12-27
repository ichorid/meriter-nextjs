import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import {
  PublicationSchemaClass,
  PublicationSchema,
} from './domain/models/publication/publication.schema';
import { VoteSchemaClass, VoteSchema } from './domain/models/vote/vote.schema';
import { PollSchemaClass, PollSchema } from './domain/models/poll/poll.schema';
import {
  PollCastSchemaClass,
  PollCastSchema,
} from './domain/models/poll/poll-cast.schema';
import { WalletSchemaClass, WalletSchema } from './domain/models/wallet/wallet.schema';
import { UserSchemaClass, UserSchema } from './domain/models/user/user.schema';
import {
  CommunitySchemaClass,
  CommunitySchema,
} from './domain/models/community/community.schema';
import {
  UserSettingsSchemaClass,
  UserSettingsSchema,
} from './domain/models/user-settings.schema';
import {
  TransactionSchemaClass,
  TransactionSchema,
} from './domain/models/transaction/transaction.schema';
import { CommentSchemaClass, CommentSchema } from './domain/models/comment/comment.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleSchema,
} from './domain/models/user-community-role/user-community-role.schema';
import { InviteSchemaClass, InviteSchema } from './domain/models/invite/invite.schema';
import {
  NotificationSchemaClass,
  NotificationSchema,
} from './domain/models/notification/notification.schema';
import {
  FavoriteSchemaClass,
  FavoriteSchema,
} from './domain/models/favorite/favorite.schema';
import {
  QuotaUsageSchemaClass,
  QuotaUsageSchema,
} from './domain/models/quota-usage/quota-usage.schema';
import { PasskeyChallenge, PasskeyChallengeSchema } from './domain/models/auth/passkey-challenge.schema';

// Import repositories (only those with valuable logic)
import { PollCastRepository } from './domain/models/poll/poll-cast.repository';

// Import domain services
import { PublicationService } from './domain/services/publication.service';
import { PollService } from './domain/services/poll.service';
import { CommunityFeedService } from './domain/services/community-feed.service';
import { WalletService } from './domain/services/wallet.service';
import { VoteService } from './domain/services/vote.service';
import { PollCastService } from './domain/services/poll-cast.service';
import { UserService } from './domain/services/user.service';
import { CommunityService } from './domain/services/community.service';
import { UserUpdatesService } from './domain/services/user-updates.service';
import { UserSettingsService } from './domain/services/user-settings.service';
import { CommentService } from './domain/services/comment.service';
import { UserCommunityRoleService } from './domain/services/user-community-role.service';
import { InviteService } from './domain/services/invite.service';
import { PermissionService } from './domain/services/permission.service';
import { MeritService } from './domain/services/merit.service';
import { NotificationService } from './domain/services/notification.service';
import { NotificationHandlersService } from './domain/services/notification-handlers.service';
import { FavoriteService } from './domain/services/favorite.service';
import { QuotaUsageService } from './domain/services/quota-usage.service';
import { CommunityDefaultsService } from './domain/services/community-defaults.service';
import { PermissionRuleEngine } from './domain/services/permission-rule-engine.service';
import { PermissionContextService } from './domain/services/permission-context.service';

// Import event bus
import { EventBus } from './domain/events/event-bus';

@Module({
  imports: [
    // Mongoose schemas
    MongooseModule.forFeature([
      { name: PublicationSchemaClass.name, schema: PublicationSchema },
      { name: VoteSchemaClass.name, schema: VoteSchema },
      { name: PollSchemaClass.name, schema: PollSchema },
      { name: PollCastSchemaClass.name, schema: PollCastSchema },
      { name: WalletSchemaClass.name, schema: WalletSchema },
      { name: UserSchemaClass.name, schema: UserSchema },
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: TransactionSchemaClass.name, schema: TransactionSchema },
      { name: UserSettingsSchemaClass.name, schema: UserSettingsSchema },
      { name: CommentSchemaClass.name, schema: CommentSchema },
      { name: UserCommunityRoleSchemaClass.name, schema: UserCommunityRoleSchema },
      { name: InviteSchemaClass.name, schema: InviteSchema },
      { name: NotificationSchemaClass.name, schema: NotificationSchema },
      { name: FavoriteSchemaClass.name, schema: FavoriteSchema },
      { name: QuotaUsageSchemaClass.name, schema: QuotaUsageSchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
    ]),
  ],
  providers: [
    // Repositories (only those with valuable logic)
    PollCastRepository,

    // Domain Services
    PublicationService,
    PollService,
    CommunityFeedService,
    WalletService,
    VoteService,
    PollCastService,
    UserService,
    CommunityService,
    CommunityDefaultsService,
    PermissionRuleEngine,
    PermissionContextService,
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    InviteService,
    PermissionService,
    MeritService,
    NotificationService,
    NotificationHandlersService,
    FavoriteService,
    QuotaUsageService,

    // Event bus
    EventBus,
  ],
  exports: [
    // Export repositories (only those with valuable logic)
    PollCastRepository,

    // Export domain services
    PublicationService,
    PollService,
    CommunityFeedService,
    WalletService,
    VoteService,
    PollCastService,
    UserService,
    CommunityService,
    CommunityDefaultsService,
    PermissionRuleEngine,
    PermissionContextService,
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    InviteService,
    PermissionService,
    MeritService,
    NotificationService,
    NotificationHandlersService,
    FavoriteService,
    QuotaUsageService,

    // Export event bus
    EventBus,
  ],
})
export class DomainModule { }
