import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
  MeriterDocumentSchema,
  MeriterDocumentSchemaClass,
} from '../../domain/models/meriter-document/meriter-document.schema';
import {
  NotificationSchema,
  NotificationSchemaClass,
} from '../../domain/models/notification/notification.schema';
import { PollSchema, PollSchemaClass } from '../../domain/models/poll/poll.schema';
import {
  PublicationSchema,
  PublicationSchemaClass,
} from '../../domain/models/publication/publication.schema';
import { TransactionSchema, TransactionSchemaClass } from '../../domain/models/transaction/transaction.schema';
import { VoteSchema, VoteSchemaClass } from '../../domain/models/vote/vote.schema';
import { WalletSchema, WalletSchemaClass } from '../../domain/models/wallet/wallet.schema';
import { communityPersistenceProvider } from './community.persistence.adapter';
import { documentPersistenceProvider } from './document.persistence.adapter';
import { eventPersistenceProvider } from './event.persistence.adapter';
import { notificationPersistenceProvider } from './notification.persistence.adapter';
import { pollPersistenceProvider } from './poll.persistence.adapter';
import { publicationPersistenceProvider } from './publication.persistence.adapter';
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
  ],
})
export class PersistenceModule {}
