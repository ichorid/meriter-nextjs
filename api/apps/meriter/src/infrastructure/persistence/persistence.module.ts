import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionSchema, TransactionSchemaClass } from '../../domain/models/transaction/transaction.schema';
import { VoteSchema, VoteSchemaClass } from '../../domain/models/vote/vote.schema';
import { WalletSchema, WalletSchemaClass } from '../../domain/models/wallet/wallet.schema';
import { walletPersistenceProvider } from './wallet.persistence.adapter';
import { votePersistenceProvider } from './vote.persistence.adapter';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletSchemaClass.name, schema: WalletSchema },
      { name: TransactionSchemaClass.name, schema: TransactionSchema },
      { name: VoteSchemaClass.name, schema: VoteSchema },
    ]),
  ],
  providers: [walletPersistenceProvider, votePersistenceProvider],
  exports: [walletPersistenceProvider, votePersistenceProvider],
})
export class PersistenceModule {}
