import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CommunitySchema,
  CommunitySchemaClass,
} from '../../domain/models/community/community.schema';
import {
  PublicationSchema,
  PublicationSchemaClass,
} from '../../domain/models/publication/publication.schema';
import { TransactionSchema, TransactionSchemaClass } from '../../domain/models/transaction/transaction.schema';
import { VoteSchema, VoteSchemaClass } from '../../domain/models/vote/vote.schema';
import { WalletSchema, WalletSchemaClass } from '../../domain/models/wallet/wallet.schema';
import { communityPersistenceProvider } from './community.persistence.adapter';
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
    ]),
  ],
  providers: [
    walletPersistenceProvider,
    votePersistenceProvider,
    publicationPersistenceProvider,
    communityPersistenceProvider,
  ],
  exports: [
    walletPersistenceProvider,
    votePersistenceProvider,
    publicationPersistenceProvider,
    communityPersistenceProvider,
  ],
})
export class PersistenceModule {}
