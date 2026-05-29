import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AboutArticleSchema,
  AboutArticleSchemaClass,
} from '../../domain/models/about/about-article.schema';
import {
  AboutCategorySchema,
  AboutCategorySchemaClass,
} from '../../domain/models/about/about-category.schema';
import {
  CategorySchema,
  CategorySchemaClass,
} from '../../domain/models/category/category.schema';
import {
  CommentSchema,
  CommentSchemaClass,
} from '../../domain/models/comment/comment.schema';
import {
  CommunityInviteSchema,
  CommunityInviteSchemaClass,
} from '../../domain/models/community-invite/community-invite.schema';
import {
  CommunityWalletSchema,
  CommunityWalletSchemaClass,
} from '../../domain/models/community-wallet/community-wallet.schema';
import {
  CommunitySchema,
  CommunitySchemaClass,
} from '../../domain/models/community/community.schema';
import {
  DocumentBlockVariantSchema,
  DocumentBlockVariantSchemaClass,
} from '../../domain/models/document-block-variant/document-block-variant.schema';
import {
  EventInviteSchema,
  EventInviteSchemaClass,
} from '../../domain/models/event-invite/event-invite.schema';
import {
  FavoriteSchema,
  FavoriteSchemaClass,
} from '../../domain/models/favorite/favorite.schema';
import {
  MeritTransferSchema,
  MeritTransferSchemaClass,
} from '../../domain/models/merit-transfer/merit-transfer.schema';
import {
  MeriterDocumentSchema,
  MeriterDocumentSchemaClass,
} from '../../domain/models/meriter-document/meriter-document.schema';
import {
  NotificationSchema,
  NotificationSchemaClass,
} from '../../domain/models/notification/notification.schema';
import { PollSchema, PollSchemaClass } from '../../domain/models/poll/poll.schema';
import {
  PlatformSettingsSchema,
  PlatformSettingsSchemaClass,
} from '../../domain/models/platform-settings/platform-settings.schema';
import {
  ProjectParentLinkRequestSchema,
  ProjectParentLinkRequestSchemaClass,
} from '../../domain/models/project-parent-link-request/project-parent-link-request.schema';
import {
  PublicationSchema,
  PublicationSchemaClass,
} from '../../domain/models/publication/publication.schema';
import {
  QuotaUsageSchema,
  QuotaUsageSchemaClass,
} from '../../domain/models/quota-usage/quota-usage.schema';
import {
  TappalkaProgressSchema,
  TappalkaProgressSchemaClass,
} from '../../domain/models/tappalka/tappalka-progress.schema';
import {
  TappalkaSessionSchema,
  TappalkaSessionSchemaClass,
} from '../../domain/models/tappalka/tappalka-session.schema';
import {
  TeamInvitationSchema,
  TeamInvitationSchemaClass,
} from '../../domain/models/team-invitation/team-invitation.schema';
import {
  TeamJoinRequestSchema,
  TeamJoinRequestSchemaClass,
} from '../../domain/models/team-join-request/team-join-request.schema';
import { TransactionSchema, TransactionSchemaClass } from '../../domain/models/transaction/transaction.schema';
import {
  UserCommunityRoleSchema,
  UserCommunityRoleSchemaClass,
} from '../../domain/models/user-community-role/user-community-role.schema';
import {
  UserSchema,
  UserSchemaClass,
} from '../../domain/models/user/user.schema';
import {
  UserSettingsSchema,
  UserSettingsSchemaClass,
} from '../../domain/models/user-settings.schema';
import { VoteSchema, VoteSchemaClass } from '../../domain/models/vote/vote.schema';
import { WalletSchema, WalletSchemaClass } from '../../domain/models/wallet/wallet.schema';
import { aboutPersistenceProvider } from './about.persistence.adapter';
import { categoryPersistenceProvider } from './category.persistence.adapter';
import { commentPersistenceProvider } from './comment.persistence.adapter';
import { communityInvitePersistenceProvider } from './community-invite.persistence.adapter';
import { communityWalletPersistenceProvider } from './community-wallet.persistence.adapter';
import { communityPersistenceProvider } from './community.persistence.adapter';
import { documentPersistenceProvider } from './document.persistence.adapter';
import { eventPersistenceProvider } from './event.persistence.adapter';
import { favoritePersistenceProvider } from './favorite.persistence.adapter';
import { investmentPersistenceProvider } from './investment.persistence.adapter';
import { meritTransferPersistenceProvider } from './merit-transfer.persistence.adapter';
import { notificationPersistenceProvider } from './notification.persistence.adapter';
import { pollPersistenceProvider } from './poll.persistence.adapter';
import { platformSettingsPersistenceProvider } from './platform-settings.persistence.adapter';
import { projectParentLinkRequestPersistenceProvider } from './project-parent-link-request.persistence.adapter';
import { publicationPersistenceProvider } from './publication.persistence.adapter';
import { quotaUsagePersistenceProvider } from './quota-usage.persistence.adapter';
import { tappalkaPersistenceProvider } from './tappalka.persistence.adapter';
import { teamInvitationPersistenceProvider } from './team-invitation.persistence.adapter';
import { teamJoinRequestPersistenceProvider } from './team-join-request.persistence.adapter';
import { ticketPersistenceProvider } from './ticket.persistence.adapter';
import { userCommunityRolePersistenceProvider } from './user-community-role.persistence.adapter';
import { userPersistenceProvider } from './user.persistence.adapter';
import { userSettingsPersistenceProvider } from './user-settings.persistence.adapter';
import { walletPersistenceProvider } from './wallet.persistence.adapter';
import { votePersistenceProvider } from './vote.persistence.adapter';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletSchemaClass.name, schema: WalletSchema },
      { name: TransactionSchemaClass.name, schema: TransactionSchema },
      { name: VoteSchemaClass.name, schema: VoteSchema },
      { name: PublicationSchemaClass.name, schema: PublicationSchema },
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: PollSchemaClass.name, schema: PollSchema },
      { name: MeriterDocumentSchemaClass.name, schema: MeriterDocumentSchema },
      { name: DocumentBlockVariantSchemaClass.name, schema: DocumentBlockVariantSchema },
      { name: EventInviteSchemaClass.name, schema: EventInviteSchema },
      { name: NotificationSchemaClass.name, schema: NotificationSchema },
      { name: CommentSchemaClass.name, schema: CommentSchema },
      { name: CategorySchemaClass.name, schema: CategorySchema },
      { name: AboutCategorySchemaClass.name, schema: AboutCategorySchema },
      { name: AboutArticleSchemaClass.name, schema: AboutArticleSchema },
      { name: FavoriteSchemaClass.name, schema: FavoriteSchema },
      { name: PlatformSettingsSchemaClass.name, schema: PlatformSettingsSchema },
      { name: UserSettingsSchemaClass.name, schema: UserSettingsSchema },
      { name: CommunityWalletSchemaClass.name, schema: CommunityWalletSchema },
      { name: CommunityInviteSchemaClass.name, schema: CommunityInviteSchema },
      { name: UserCommunityRoleSchemaClass.name, schema: UserCommunityRoleSchema },
      { name: UserSchemaClass.name, schema: UserSchema },
      { name: MeritTransferSchemaClass.name, schema: MeritTransferSchema },
      { name: TeamInvitationSchemaClass.name, schema: TeamInvitationSchema },
      { name: TeamJoinRequestSchemaClass.name, schema: TeamJoinRequestSchema },
      { name: ProjectParentLinkRequestSchemaClass.name, schema: ProjectParentLinkRequestSchema },
      { name: QuotaUsageSchemaClass.name, schema: QuotaUsageSchema },
      { name: TappalkaProgressSchemaClass.name, schema: TappalkaProgressSchema },
      { name: TappalkaSessionSchemaClass.name, schema: TappalkaSessionSchema },
    ]),
  ],
  providers: [
    walletPersistenceProvider,
    votePersistenceProvider,
    publicationPersistenceProvider,
    communityPersistenceProvider,
    pollPersistenceProvider,
    documentPersistenceProvider,
    eventPersistenceProvider,
    notificationPersistenceProvider,
    commentPersistenceProvider,
    categoryPersistenceProvider,
    aboutPersistenceProvider,
    favoritePersistenceProvider,
    platformSettingsPersistenceProvider,
    userSettingsPersistenceProvider,
    communityWalletPersistenceProvider,
    communityInvitePersistenceProvider,
    userCommunityRolePersistenceProvider,
    userPersistenceProvider,
    meritTransferPersistenceProvider,
    investmentPersistenceProvider,
    ticketPersistenceProvider,
    teamInvitationPersistenceProvider,
    teamJoinRequestPersistenceProvider,
    projectParentLinkRequestPersistenceProvider,
    quotaUsagePersistenceProvider,
    tappalkaPersistenceProvider,
  ],
  exports: [
    walletPersistenceProvider,
    votePersistenceProvider,
    publicationPersistenceProvider,
    communityPersistenceProvider,
    pollPersistenceProvider,
    documentPersistenceProvider,
    eventPersistenceProvider,
    notificationPersistenceProvider,
    commentPersistenceProvider,
    categoryPersistenceProvider,
    aboutPersistenceProvider,
    favoritePersistenceProvider,
    platformSettingsPersistenceProvider,
    userSettingsPersistenceProvider,
    communityWalletPersistenceProvider,
    communityInvitePersistenceProvider,
    userCommunityRolePersistenceProvider,
    userPersistenceProvider,
    meritTransferPersistenceProvider,
    investmentPersistenceProvider,
    ticketPersistenceProvider,
    teamInvitationPersistenceProvider,
    teamJoinRequestPersistenceProvider,
    projectParentLinkRequestPersistenceProvider,
    quotaUsagePersistenceProvider,
    tappalkaPersistenceProvider,
  ],
})
export class PersistenceModule {}
