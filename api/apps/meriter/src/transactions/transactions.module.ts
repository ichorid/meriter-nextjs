import { Module } from '@nestjs/common';
import { AgreementsModule } from '@common/abstracts/agreements/agreements.module';
import { TransactionsService } from './transactions.service';
import { WalletsModule } from '../wallets/wallets.module';
import { PublicationsModule } from '../publications/publications.module';
import { UsersModule } from '../users/users.module';
import { HashtagsModule } from '../hashtags/hashtags.module';
import { UpdatesConductorsModule } from '../updates-conductors/updates-conductors.module';

@Module({
  imports: [
    AgreementsModule,
    WalletsModule,
    PublicationsModule,
    UsersModule,
    HashtagsModule,
    UpdatesConductorsModule,
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
