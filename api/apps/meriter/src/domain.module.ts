import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import {
  Publication,
  PublicationSchema,
} from './domain/models/publication/publication.schema';
import { Vote, VoteSchema } from './domain/models/vote/vote.schema';
import { Poll, PollSchema } from './domain/models/poll/poll.schema';
import {
  PollCast,
  PollCastSchema,
} from './domain/models/poll/poll-cast.schema';
import { Wallet, WalletSchema } from './domain/models/wallet/wallet.schema';
import { User, UserSchema } from './domain/models/user/user.schema';
import {
  Community,
  CommunitySchema,
} from './domain/models/community/community.schema';
import {
  UserSettings,
  UserSettingsSchema,
} from './domain/models/user-settings.schema';
import {
  Transaction,
  TransactionSchema,
} from './domain/models/transaction/transaction.schema';
import { Comment, CommentSchema } from './domain/models/comment/comment.schema';
import {
  UserCommunityRole,
  UserCommunityRoleSchema,
} from './domain/models/user-community-role/user-community-role.schema';
import { Invite, InviteSchema } from './domain/models/invite/invite.schema';

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

// Import event bus
import { EventBus } from './domain/events/event-bus';

@Module({
  imports: [
    // Mongoose schemas
    MongooseModule.forFeature([
      { name: Publication.name, schema: PublicationSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: Poll.name, schema: PollSchema },
      { name: PollCast.name, schema: PollCastSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: User.name, schema: UserSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: UserCommunityRole.name, schema: UserCommunityRoleSchema },
      { name: Invite.name, schema: InviteSchema },
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
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    InviteService,
    PermissionService,
    MeritService,

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
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    InviteService,
    PermissionService,
    MeritService,

    // Export event bus
    EventBus,
  ],
})
export class DomainModule {}
