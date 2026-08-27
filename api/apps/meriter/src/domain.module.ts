import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { getConnectionToken, InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config/configuration';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';

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
import {
  CategorySchemaClass,
  CategorySchema,
} from './domain/models/category/category.schema';
import {
  AboutCategorySchemaClass,
  AboutCategorySchema,
} from './domain/models/about/about-category.schema';
import {
  AboutArticleSchemaClass,
  AboutArticleSchema,
} from './domain/models/about/about-article.schema';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressSchema,
} from './domain/models/tappalka/tappalka-progress.schema';
import {
  TappalkaSessionSchemaClass,
  TappalkaSessionSchema,
} from './domain/models/tappalka/tappalka-session.schema';
import {
  TeamJoinRequestSchemaClass,
  TeamJoinRequestSchema,
} from './domain/models/team-join-request/team-join-request.schema';
import {
  ProjectParentLinkRequestSchemaClass,
  ProjectParentLinkRequestSchema,
} from './domain/models/project-parent-link-request/project-parent-link-request.schema';
import {
  TeamInvitationSchemaClass,
  TeamInvitationSchema,
} from './domain/models/team-invitation/team-invitation.schema';
import {
  PlatformSettingsSchemaClass,
  PlatformSettingsSchema,
} from './domain/models/platform-settings/platform-settings.schema';
import {
  CommunityWalletSchemaClass,
  CommunityWalletSchema,
} from './domain/models/community-wallet/community-wallet.schema';
import {
  MeritTransferSchemaClass,
  MeritTransferSchema,
} from './domain/models/merit-transfer/merit-transfer.schema';
import {
  EventInviteSchemaClass,
  EventInviteSchema,
} from './domain/models/event-invite/event-invite.schema';
import {
  CommunityInviteSchemaClass,
  CommunityInviteSchema,
} from './domain/models/community-invite/community-invite.schema';
import {
  MeriterDocumentSchemaClass,
  MeriterDocumentSchema,
} from './domain/models/meriter-document/meriter-document.schema';
import {
  DocumentBlockVariantSchemaClass,
  DocumentBlockVariantSchema,
} from './domain/models/document-block-variant/document-block-variant.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorSchema,
} from './domain/models/telegram/telegram-publication-anchor.schema';
import {
  TelegramChatMemberDirectorySchemaClass,
  TelegramChatMemberDirectorySchema,
} from './domain/models/telegram/telegram-chat-member-directory.schema';
import {
  UZZ_COMMAND_MODEL,
  UzzCommandPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-command.schema';
import {
  UZZ_DEAL_MODEL,
  UzzDealPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-deal.schema';
import {
  UZZ_EXCHANGE_RIGHT_MODEL,
  UzzExchangeRightPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-exchange-right.schema';
import {
  UZZ_IDENTITY_ALIAS_MODEL,
  UzzIdentityAliasPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-identity-alias.schema';
import {
  UZZ_IDENTITY_TOKEN_MODEL,
  UzzIdentityTokenPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-identity-token.schema';
import {
  UZZ_IDENTITY_MODEL,
  UzzIdentityPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-identity.schema';
import {
  UZZ_LEDGER_MODEL,
  UzzLedgerPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-ledger.schema';
import {
  UZZ_LISTING_MODEL,
  UzzListingPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-listing.schema';
import {
  UZZ_OUTBOX_MODEL,
  UzzOutboxPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-outbox.schema';
import {
  UZZ_SETTINGS_MODEL,
  UzzSettingsPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-settings.schema';
import { MongooseUzzUnitOfWork } from './infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { silenceLegacyGroupAnnouncements } from './infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { runUzzIndexPreflight } from './infrastructure/uzz/persistence/verify-uzz-indexes';
import { UZZ_UNIT_OF_WORK } from './application/uzz/ports/uzz-unit-of-work';
import { StartTelegramLinkUseCase } from './application/uzz/use-cases/start-telegram-link.use-case';
import { ConfirmTelegramLinkUseCase } from './application/uzz/use-cases/confirm-telegram-link.use-case';
import { UzzTokenHasher } from './infrastructure/uzz/security/uzz-token-hasher';
import { MongooseUzzRateLimiter } from './infrastructure/uzz/security/mongoose-uzz-rate-limiter';
import {
  UZZ_RATE_LIMIT_MODEL,
  UzzRateLimitPersistenceSchema,
} from './infrastructure/uzz/persistence/schemas/uzz-rate-limit.schema';
import { UZZ_RATE_LIMITER_PORT } from './application/uzz/ports/uzz-identity.port';
import {
  UZZ_COMMUNITY_ACCESS_PORT,
  UzzCommunityAccessPort,
} from './application/uzz/ports/uzz-community-access.port';
import { UZZ_PLATFORM_PORT, UzzPlatformPort } from './application/uzz/ports/uzz-platform.port';
import { UzzAuthorizationService } from './application/uzz/uzz-authorization.service';
import { UzzApplicationFacade } from './application/uzz/uzz-application.facade';
import { UzzAccessPolicy } from './application/uzz/policies/uzz-access-policy';
import { CreateListingUseCase } from './application/uzz/use-cases/create-listing.use-case';
import { UpdateListingUseCase } from './application/uzz/use-cases/update-listing.use-case';
import { ListCatalogUseCase } from './application/uzz/use-cases/list-catalog.use-case';
import { CheckPurchaseGateUseCase } from './application/uzz/use-cases/check-purchase-gate.use-case';
import { RequestDealUseCase } from './application/uzz/use-cases/request-deal.use-case';
import { AcceptDealUseCase } from './application/uzz/use-cases/accept-deal.use-case';
import { RejectDealUseCase } from './application/uzz/use-cases/reject-deal.use-case';
import { CancelDealUseCase } from './application/uzz/use-cases/cancel-deal.use-case';
import { MarkDealCompletedUseCase } from './application/uzz/use-cases/mark-deal-completed.use-case';
import { CloseDealUseCase } from './application/uzz/use-cases/close-deal.use-case';
import { AdminResolveDealUseCase } from './application/uzz/use-cases/admin-resolve-deal.use-case';
import { GetSettingsUseCase } from './application/uzz/use-cases/get-settings.use-case';
import { UpdateSettingsUseCase } from './application/uzz/use-cases/update-settings.use-case';
import { AssignRightNominalUseCase } from './application/uzz/use-cases/assign-right-nominal.use-case';
import { ApplyDemurrageUseCase } from './application/uzz/use-cases/apply-demurrage.use-case';
import { ExpireDealsUseCase } from './application/uzz/use-cases/expire-deals.use-case';
import { SendDealThanksUseCase } from './application/uzz/use-cases/send-deal-thanks.use-case';
import { EmitExchangeRightUseCase } from './application/uzz/use-cases/emit-exchange-right.use-case';
import { ListDeedsUseCase } from './application/uzz/use-cases/list-deeds.use-case';
import { BackfillExchangeRightsUseCase } from './application/uzz/use-cases/backfill-exchange-rights.use-case';
import {
  ListPilotCommunitiesUseCase,
  SetPilotCommunityUseCase,
} from './application/uzz/use-cases/pilot-community.use-case';
import {
  readSelectedCommunityId,
  resolveConfiguredCommunityId,
  writeSelectedCommunityId,
} from './infrastructure/uzz/persistence/uzz-platform-selection';
import { mongoActiveTelegramCommunityFilter } from './infrastructure/telegram/telegram-community-frozen.util';
import { SYSTEM_CLOCK } from './application/uzz/ports/clock.port';
import { GLOBAL_COMMUNITY_ID } from './domain/common/constants/global.constant';

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
import { PermissionService } from './domain/services/permission.service';
import { MeritService } from './domain/services/merit.service';
import { NotificationService } from './domain/services/notification.service';
import { NotificationHandlersService } from './domain/services/notification-handlers.service';
import { FavoriteService } from './domain/services/favorite.service';
import { QuotaUsageService } from './domain/services/quota-usage.service';
import { CommunityDefaultsService } from './domain/services/community-defaults.service';
import { CommunityEffectiveSettingsService } from './domain/services/community-effective-settings.service';
import { CommunityMembershipService } from './domain/services/community-membership.service';
import { CategoryService } from './domain/services/category.service';
import { AboutService } from './domain/services/about.service';
import { PermissionRuleEngine } from './domain/services/permission-rule-engine.service';
import { PermissionContextService } from './domain/services/permission-context.service';
import { PERMISSION_GATES_PORT } from './domain/ports/permission-gates.port';
import { TappalkaService } from './domain/services/tappalka.service';
import { InvestmentService } from './domain/services/investment.service';
import { PostClosingService } from './domain/services/post-closing.service';
import { MeritResolverService } from './domain/services/merit-resolver.service';
import { WalletContextResolverService } from './domain/services/wallet-context-resolver.service';
import { TeamJoinRequestService } from './domain/services/team-join-request.service';
import { TeamInvitationService } from './domain/services/team-invitation.service';
import { PlatformSettingsService } from './domain/services/platform-settings.service';
import { ValueTagsSuggestionService } from './domain/services/value-tags-suggestion.service';
import { CommunityWalletService } from './domain/services/community-wallet.service';
import { ProjectService } from './domain/services/project.service';
import { ProjectParentLinkRequestService } from './domain/services/project-parent-link-request.service';
import { TicketService } from './domain/services/ticket.service';
import { ProjectDistributionService } from './domain/services/project-distribution.service';
import { ProjectPayoutService } from './domain/services/project-payout.service';
import { PlatformWipeService } from './domain/services/platform-wipe.service';
import { PlatformDemoSeedService } from './domain/services/platform-demo-seed.service';
import { PlatformDemoEventsSeedService } from './domain/services/platform-demo-events-seed.service';
import { PlatformEntrepreneursDemoSeedService } from './domain/services/platform-entrepreneurs-demo-seed.service';
import { CommunityWebDevSeedService } from './domain/services/community-web-dev-seed.service';
import { CommunityWebDevAutoseedService } from './domain/services/community-web-dev-autoseed.service';
import { PlatformDemoPackImportService } from './domain/services/platform-demo-pack-import.service';
import { PlatformDatabaseDumpService } from './domain/services/platform-database-dump.service';
import { Decree809TagMigrationService } from './domain/services/decree809-tag-migration.service';
import { CollaborativeDocumentsMigrationService } from './domain/services/collaborative-documents-migration.service';
import { TelegramCommunityPrivacyMigrationService } from './domain/services/telegram-community-privacy-migration.service';
import { MeritTransferService } from './domain/services/merit-transfer.service';
import { EventService } from './domain/services/event.service';
import { CommunityInviteService } from './domain/services/community-invite.service';
import { DocumentService } from './domain/services/document.service';
import { DocumentVariantService } from './domain/services/document-variant.service';
import { DocumentStructureService } from './domain/services/document-structure.service';
import { DocumentHtmlSyncService } from './domain/services/document-html-sync.service';
import { DocumentLiveUpdatesService } from './domain/services/document-live-updates.service';

// Import vote factor services
import { RoleHierarchyFactor } from './domain/services/factors/role-hierarchy.factor';
import { SocialCurrencyConstraintFactor } from './domain/services/factors/social-currency-constraint.factor';
import { ContextCurrencyModeFactor } from './domain/services/factors/context-currency-mode.factor';
import { CurrencyModeFactor } from './domain/services/factors/currency-mode.factor';
import { VoteFactorService } from './domain/services/vote-factor.service';

// Import event bus
import { EventBus } from './domain/events/event-bus';

@Module({
  imports: [
    PersistenceModule,
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
      { name: NotificationSchemaClass.name, schema: NotificationSchema },
      { name: FavoriteSchemaClass.name, schema: FavoriteSchema },
      { name: QuotaUsageSchemaClass.name, schema: QuotaUsageSchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
      { name: CategorySchemaClass.name, schema: CategorySchema },
      { name: AboutCategorySchemaClass.name, schema: AboutCategorySchema },
      { name: AboutArticleSchemaClass.name, schema: AboutArticleSchema },
      { name: TappalkaProgressSchemaClass.name, schema: TappalkaProgressSchema },
      { name: TappalkaSessionSchemaClass.name, schema: TappalkaSessionSchema },
      { name: TeamJoinRequestSchemaClass.name, schema: TeamJoinRequestSchema },
      {
        name: ProjectParentLinkRequestSchemaClass.name,
        schema: ProjectParentLinkRequestSchema,
      },
      { name: TeamInvitationSchemaClass.name, schema: TeamInvitationSchema },
      { name: PlatformSettingsSchemaClass.name, schema: PlatformSettingsSchema },
      { name: CommunityWalletSchemaClass.name, schema: CommunityWalletSchema },
      { name: MeritTransferSchemaClass.name, schema: MeritTransferSchema },
      { name: EventInviteSchemaClass.name, schema: EventInviteSchema },
      { name: CommunityInviteSchemaClass.name, schema: CommunityInviteSchema },
      { name: MeriterDocumentSchemaClass.name, schema: MeriterDocumentSchema },
      {
        name: DocumentBlockVariantSchemaClass.name,
        schema: DocumentBlockVariantSchema,
      },
      {
        name: TelegramPublicationAnchorSchemaClass.name,
        schema: TelegramPublicationAnchorSchema,
      },
      {
        name: TelegramChatMemberDirectorySchemaClass.name,
        schema: TelegramChatMemberDirectorySchema,
      },
      { name: UZZ_COMMAND_MODEL, schema: UzzCommandPersistenceSchema },
      { name: UZZ_DEAL_MODEL, schema: UzzDealPersistenceSchema },
      {
        name: UZZ_EXCHANGE_RIGHT_MODEL,
        schema: UzzExchangeRightPersistenceSchema,
      },
      {
        name: UZZ_IDENTITY_ALIAS_MODEL,
        schema: UzzIdentityAliasPersistenceSchema,
      },
      {
        name: UZZ_IDENTITY_TOKEN_MODEL,
        schema: UzzIdentityTokenPersistenceSchema,
      },
      { name: UZZ_IDENTITY_MODEL, schema: UzzIdentityPersistenceSchema },
      { name: UZZ_LEDGER_MODEL, schema: UzzLedgerPersistenceSchema },
      { name: UZZ_LISTING_MODEL, schema: UzzListingPersistenceSchema },
      { name: UZZ_OUTBOX_MODEL, schema: UzzOutboxPersistenceSchema },
      { name: UZZ_SETTINGS_MODEL, schema: UzzSettingsPersistenceSchema },
      { name: UZZ_RATE_LIMIT_MODEL, schema: UzzRateLimitPersistenceSchema },
    ]),
  ],
  providers: [
    // Repositories (only those with valuable logic)
    PollCastRepository,
    MongooseUzzUnitOfWork,
    {
      provide: UZZ_UNIT_OF_WORK,
      useExisting: MongooseUzzUnitOfWork,
    },
    UzzTokenHasher,
    MongooseUzzRateLimiter,
    {
      provide: UZZ_RATE_LIMITER_PORT,
      useExisting: MongooseUzzRateLimiter,
    },
    {
      provide: StartTelegramLinkUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzTokenHasher, UZZ_RATE_LIMITER_PORT],
      useFactory: (unitOfWork, tokenHasher, rateLimiter) =>
        new StartTelegramLinkUseCase(unitOfWork, tokenHasher, rateLimiter),
    },
    {
      provide: ConfirmTelegramLinkUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzTokenHasher, UZZ_RATE_LIMITER_PORT],
      useFactory: (unitOfWork, tokenHasher, rateLimiter) =>
        new ConfirmTelegramLinkUseCase(unitOfWork, tokenHasher, rateLimiter),
    },
    {
      provide: UZZ_COMMUNITY_ACCESS_PORT,
      inject: [CommunityMembershipService, UserService],
      useFactory: (
        membership: CommunityMembershipService,
        users: UserService,
      ): UzzCommunityAccessPort => ({
        async isAnyMember(communityId, userIds) {
          for (const userId of userIds) {
            if (await membership.isUserMember(communityId, userId)) {
              return true;
            }
          }
          return false;
        },
        async isAnyAdmin(communityId, userIds) {
          for (const userId of userIds) {
            if (await membership.isUserAdmin(communityId, userId)) return true;
          }
          return false;
        },
        async isSuperAdmin(userIds) {
          for (const userId of userIds) {
            if ((await users.getUserById(userId))?.globalRole === 'superadmin') return true;
          }
          return false;
        },
      }),
    },
    {
      provide: UzzAuthorizationService,
      inject: [UZZ_UNIT_OF_WORK, UZZ_COMMUNITY_ACCESS_PORT],
      useFactory: (unitOfWork, access) => new UzzAuthorizationService(unitOfWork, access),
    },
    {
      provide: UZZ_PLATFORM_PORT,
      inject: [ConfigService, CommunityService, PublicationService, UserService, getConnectionToken()],
      useFactory: (
        config: ConfigService<AppConfig>,
        communities: CommunityService,
        publications: PublicationService,
        users: UserService,
        connection: Connection,
      ): UzzPlatformPort => {
        const toUzzPublication = (snapshot: {
          id: string; communityId: string; authorId: string; beneficiaryId?: string | null;
          title?: string | null; content?: string | null; metrics?: { score?: number };
          postType?: string | null; deleted?: boolean;
        }) => ({
          id: snapshot.id, communityId: snapshot.communityId,
          authorId: snapshot.authorId,
          ownerId: snapshot.beneficiaryId || snapshot.authorId,
          title: (snapshot.title?.trim() || (snapshot.content ?? '').replace(/<[^>]+>/g, ' ').trim() || 'Доброе дело').slice(0, 160),
          score: snapshot.metrics?.score ?? 0,
          postType: snapshot.postType ?? null,
          deleted: Boolean(snapshot.deleted),
        });
        const isDeedSnapshot = (snapshot: {
          communityId: string; deleted?: boolean; postType?: string | null;
        }) => !snapshot.deleted && (!snapshot.postType || snapshot.postType === 'basic');
        return {
        async configuredCommunityId() {
          const env = config.get('app')?.defaultTelegramCommunityId?.trim() ?? '';
          const db = connection.db;
          if (!db) return env;
          return resolveConfiguredCommunityId(await readSelectedCommunityId(db), env);
        },
        async setSelectedCommunityId(communityId) {
          const db = connection.db;
          if (!db) throw new Error('Mongo database unavailable');
          await writeSelectedCommunityId(db, communityId);
        },
        async listTelegramCommunities() {
          const rows = await communities.listCommunitiesByQuery({
            telegramChatId: { $exists: true, $nin: [null, ''] },
            ...mongoActiveTelegramCommunityFilter(),
          }, 500, 0, { name: 1 });
          return rows.map((community) => ({
            id: community.id, name: community.name,
            telegramChatId: community.telegramChatId ? String(community.telegramChatId) : null,
          }));
        },
        async getCommunity(communityId) {
          const community = await communities.getCommunity(communityId);
          return community ? {
            id: community.id, name: community.name,
            telegramChatId: community.telegramChatId ? String(community.telegramChatId) : null,
          } : null;
        },
        async getPublication(publicationId) {
          const publication = await publications.getPublication(publicationId);
          if (!publication) return null;
          return toUzzPublication(publication.toSnapshot());
        },
        async listDeedPublications(communityId, userIds) {
          const batches = await Promise.all([
            ...userIds.map((userId) => publications.getPublicationsByAuthor(userId, 100, 0)),
            ...userIds.map((userId) => publications.getPublicationsByBeneficiary(userId, 100, 0)),
          ]);
          const userIdSet = new Set(userIds);
          const seen = new Set<string>();
          return batches.flat().map((publication) => publication.toSnapshot())
            .filter((snapshot) => snapshot.communityId === communityId
              && isDeedSnapshot(snapshot)
              && userIdSet.has(snapshot.beneficiaryId || snapshot.authorId))
            .filter((snapshot) => !seen.has(snapshot.id) && seen.add(snapshot.id))
            .map(toUzzPublication);
        },
        async listEligibleDeedPublications(communityId, minScore, limit) {
          const rows = await publications.findPublicationsByQuery({
            query: {
              communityId,
              deleted: { $ne: true },
              'metrics.score': { $gte: minScore },
              $or: [
                { postType: 'basic' },
                { postType: null },
                { postType: { $exists: false } },
              ],
            },
            limit,
            sort: { 'metrics.score': -1 },
          });
          return rows.filter(isDeedSnapshot).map(toUzzPublication);
        },
        getUserLabels: (userIds) => users.getUserLabelsByUserIds(userIds),
      };
      },
    },
    {
      provide: UzzAccessPolicy,
      inject: [UZZ_COMMUNITY_ACCESS_PORT],
      useFactory: (access: UzzCommunityAccessPort) => new UzzAccessPolicy(access),
    },
    {
      provide: CreateListingUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAccessPolicy],
      useFactory: (unitOfWork, accessPolicy) =>
        new CreateListingUseCase(unitOfWork, accessPolicy),
    },
    {
      provide: UpdateListingUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAccessPolicy],
      useFactory: (unitOfWork, accessPolicy) =>
        new UpdateListingUseCase(unitOfWork, accessPolicy),
    },
    {
      provide: ListCatalogUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new ListCatalogUseCase(unitOfWork),
    },
    {
      provide: CheckPurchaseGateUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAccessPolicy],
      useFactory: (unitOfWork, accessPolicy) =>
        new CheckPurchaseGateUseCase(unitOfWork, accessPolicy),
    },
    {
      provide: RequestDealUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAccessPolicy],
      useFactory: (unitOfWork, accessPolicy) =>
        new RequestDealUseCase(unitOfWork, accessPolicy, GLOBAL_COMMUNITY_ID),
    },
    {
      provide: AcceptDealUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAccessPolicy],
      useFactory: (unitOfWork, accessPolicy) =>
        new AcceptDealUseCase(unitOfWork, accessPolicy),
    },
    {
      provide: RejectDealUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new RejectDealUseCase(unitOfWork),
    },
    {
      provide: CancelDealUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new CancelDealUseCase(unitOfWork),
    },
    {
      provide: MarkDealCompletedUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new MarkDealCompletedUseCase(unitOfWork),
    },
    {
      provide: CloseDealUseCase,
      inject: [UZZ_UNIT_OF_WORK, UZZ_PLATFORM_PORT],
      useFactory: (unitOfWork, platform: UzzPlatformPort) =>
        new CloseDealUseCase(unitOfWork, platform),
    },
    {
      provide: AdminResolveDealUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAuthorizationService],
      useFactory: (unitOfWork, authorization: UzzAuthorizationService) =>
        new AdminResolveDealUseCase(unitOfWork, authorization),
    },
    {
      provide: GetSettingsUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAuthorizationService],
      useFactory: (unitOfWork, authorization: UzzAuthorizationService) =>
        new GetSettingsUseCase(unitOfWork, authorization),
    },
    {
      provide: UpdateSettingsUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAuthorizationService],
      useFactory: (unitOfWork, authorization: UzzAuthorizationService) =>
        new UpdateSettingsUseCase(unitOfWork, authorization, SYSTEM_CLOCK),
    },
    {
      provide: AssignRightNominalUseCase,
      inject: [UZZ_UNIT_OF_WORK, UzzAuthorizationService],
      useFactory: (unitOfWork, authorization: UzzAuthorizationService) =>
        new AssignRightNominalUseCase(unitOfWork, authorization, SYSTEM_CLOCK),
    },
    {
      provide: ApplyDemurrageUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new ApplyDemurrageUseCase(unitOfWork, SYSTEM_CLOCK),
    },
    {
      provide: ExpireDealsUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new ExpireDealsUseCase(unitOfWork, SYSTEM_CLOCK),
    },
    {
      provide: SendDealThanksUseCase,
      inject: [UZZ_UNIT_OF_WORK],
      useFactory: (unitOfWork) => new SendDealThanksUseCase(unitOfWork, GLOBAL_COMMUNITY_ID),
    },
    {
      provide: EmitExchangeRightUseCase,
      inject: [UZZ_UNIT_OF_WORK, UZZ_PLATFORM_PORT],
      useFactory: (unitOfWork, platform: UzzPlatformPort) =>
        new EmitExchangeRightUseCase(unitOfWork, platform, SYSTEM_CLOCK),
    },
    {
      provide: ListPilotCommunitiesUseCase,
      inject: [UZZ_PLATFORM_PORT, UzzAuthorizationService],
      useFactory: (platform: UzzPlatformPort, authorization: UzzAuthorizationService) =>
        new ListPilotCommunitiesUseCase(platform, authorization),
    },
    {
      provide: SetPilotCommunityUseCase,
      inject: [UZZ_PLATFORM_PORT, UzzAuthorizationService],
      useFactory: (platform: UzzPlatformPort, authorization: UzzAuthorizationService) =>
        new SetPilotCommunityUseCase(platform, authorization),
    },
    {
      provide: ListDeedsUseCase,
      inject: [
        UZZ_UNIT_OF_WORK, UZZ_PLATFORM_PORT, EmitExchangeRightUseCase,
        UzzAuthorizationService,
      ],
      useFactory: (
        unitOfWork: UzzUnitOfWork,
        platform: UzzPlatformPort,
        emitRight: EmitExchangeRightUseCase,
        authorization: UzzAuthorizationService,
      ) => new ListDeedsUseCase(unitOfWork, platform, emitRight, authorization),
    },
    {
      provide: BackfillExchangeRightsUseCase,
      inject: [
        UZZ_UNIT_OF_WORK, UZZ_PLATFORM_PORT, EmitExchangeRightUseCase,
        UzzAuthorizationService,
      ],
      useFactory: (
        unitOfWork: UzzUnitOfWork,
        platform: UzzPlatformPort,
        emitRight: EmitExchangeRightUseCase,
        authorization: UzzAuthorizationService,
      ) => new BackfillExchangeRightsUseCase(
        unitOfWork, platform, emitRight, authorization, SYSTEM_CLOCK,
      ),
    },
    {
      provide: UzzApplicationFacade,
      inject: [
        UZZ_UNIT_OF_WORK, UzzAuthorizationService, UZZ_PLATFORM_PORT,
        EmitExchangeRightUseCase, GetSettingsUseCase, UpdateSettingsUseCase,
        AssignRightNominalUseCase, CreateListingUseCase, UpdateListingUseCase,
        ListCatalogUseCase, CheckPurchaseGateUseCase, RequestDealUseCase,
        AcceptDealUseCase, RejectDealUseCase, CancelDealUseCase,
        MarkDealCompletedUseCase, CloseDealUseCase, AdminResolveDealUseCase,
        SendDealThanksUseCase, StartTelegramLinkUseCase,
        ListPilotCommunitiesUseCase, SetPilotCommunityUseCase, ListDeedsUseCase,
        BackfillExchangeRightsUseCase,
      ],
      useFactory: (
        unitOfWork, authorization, platform, emitRight,
        getSettings, updateSettings, assignRightNominal,
        createListing, updateListing, listCatalog, checkPurchaseGate,
        requestDeal, acceptDeal, rejectDeal, cancelDeal, markDealCompleted,
        closeDeal, adminResolveDeal, sendDealThanks, startTelegramLink,
        listPilotCommunities, setPilotCommunity, listDeeds, backfillRights,
      ) =>
        new UzzApplicationFacade(
          unitOfWork, authorization, platform, emitRight, GLOBAL_COMMUNITY_ID,
          {
            getSettings, updateSettings, listPilotCommunities, setPilotCommunity,
            assignRightNominal,
            createListing, updateListing, listCatalog, checkPurchaseGate,
            requestDeal, acceptDeal, rejectDeal, cancelDeal, markDealCompleted,
            closeDeal, adminResolveDeal, sendDealThanks, startTelegramLink,
            listDeeds, backfillRights,
          },
        ),
    },

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
    CommunityEffectiveSettingsService,
    CommunityMembershipService,
    PermissionRuleEngine,
    {
      provide: PERMISSION_GATES_PORT,
      useExisting: PermissionRuleEngine,
    },
    PermissionContextService,
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    PermissionService,
    MeritService,
    NotificationService,
    NotificationHandlersService,
    FavoriteService,
    QuotaUsageService,
    CategoryService,
    AboutService,
    TappalkaService,
    InvestmentService,
    PostClosingService,
    MeritResolverService,
    WalletContextResolverService,
    TeamJoinRequestService,
    TeamInvitationService,
    PlatformSettingsService,
    ValueTagsSuggestionService,
    CommunityWalletService,
    ProjectParentLinkRequestService,
    ProjectPayoutService,
    ProjectService,
    TicketService,
    ProjectDistributionService,
    PlatformWipeService,
    PlatformDemoSeedService,
    PlatformDemoEventsSeedService,
    PlatformEntrepreneursDemoSeedService,
    CommunityWebDevSeedService,
    CommunityWebDevAutoseedService,
    PlatformDemoPackImportService,
    PlatformDatabaseDumpService,
    Decree809TagMigrationService,
    CollaborativeDocumentsMigrationService,
    TelegramCommunityPrivacyMigrationService,
    MeritTransferService,
    EventService,
    CommunityInviteService,
    DocumentService,
    DocumentVariantService,
    DocumentStructureService,
    DocumentHtmlSyncService,
    DocumentLiveUpdatesService,

    // Vote Factor Services
    RoleHierarchyFactor,
    SocialCurrencyConstraintFactor,
    ContextCurrencyModeFactor,
    CurrencyModeFactor,
    VoteFactorService,

    // Event bus
    EventBus,
  ],
  exports: [
    // Export repositories (only those with valuable logic)
    PollCastRepository,
    UZZ_UNIT_OF_WORK,
    StartTelegramLinkUseCase,
    ConfirmTelegramLinkUseCase,
    UzzTokenHasher,
    MongooseUzzRateLimiter,
    UZZ_RATE_LIMITER_PORT,
    CreateListingUseCase,
    UpdateListingUseCase,
    ListCatalogUseCase,
    CheckPurchaseGateUseCase,
    RequestDealUseCase,
    AcceptDealUseCase,
    RejectDealUseCase,
    CancelDealUseCase,
    MarkDealCompletedUseCase,
    CloseDealUseCase,
    AdminResolveDealUseCase,
    GetSettingsUseCase,
    UpdateSettingsUseCase,
    AssignRightNominalUseCase,
    ApplyDemurrageUseCase,
    ExpireDealsUseCase,
    SendDealThanksUseCase,
    EmitExchangeRightUseCase,
    ListDeedsUseCase,
    BackfillExchangeRightsUseCase,
    ListPilotCommunitiesUseCase,
    SetPilotCommunityUseCase,
    UzzAuthorizationService,
    UzzApplicationFacade,

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
    CommunityEffectiveSettingsService,
    CommunityMembershipService,
    PermissionRuleEngine,
    {
      provide: PERMISSION_GATES_PORT,
      useExisting: PermissionRuleEngine,
    },
    PermissionContextService,
    UserUpdatesService,
    UserSettingsService,
    CommentService,
    UserCommunityRoleService,
    PermissionService,
    MeritService,
    NotificationService,
    NotificationHandlersService,
    FavoriteService,
    QuotaUsageService,
    CategoryService,
    AboutService,
    TappalkaService,
    InvestmentService,
    PostClosingService,
    MeritResolverService,
    WalletContextResolverService,
    TeamJoinRequestService,
    TeamInvitationService,
    PlatformSettingsService,
    ValueTagsSuggestionService,
    CommunityWalletService,
    ProjectPayoutService,
    ProjectService,
    TicketService,
    ProjectDistributionService,
    PlatformWipeService,
    PlatformDemoSeedService,
    PlatformDemoEventsSeedService,
    PlatformEntrepreneursDemoSeedService,
    CommunityWebDevSeedService,
    CommunityWebDevAutoseedService,
    PlatformDemoPackImportService,
    PlatformDatabaseDumpService,
    MeritTransferService,
    EventService,
    CommunityInviteService,
    DocumentService,
    DocumentVariantService,
    DocumentStructureService,
    DocumentHtmlSyncService,
    DocumentLiveUpdatesService,

    // Export vote factor services
    RoleHierarchyFactor,
    SocialCurrencyConstraintFactor,
    ContextCurrencyModeFactor,
    CurrencyModeFactor,
    VoteFactorService,

    // Export event bus
    EventBus,
  ],
})
export class DomainModule implements OnModuleInit {
  private readonly logger = new Logger(DomainModule.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    await runUzzIndexPreflight(this.connection.db, process.env, this.logger);
    await silenceLegacyGroupAnnouncements(this.connection);
  }
}
