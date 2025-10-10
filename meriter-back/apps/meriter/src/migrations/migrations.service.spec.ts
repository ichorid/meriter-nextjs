import { Test, TestingModule } from '@nestjs/testing';
import { MigrationsService } from './migrations.service';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { CountersModule } from '@common/abstracts/counters/counters.module';
import { OldWallet, OldWalletSchema } from './schemas/old-wallet.schema';
import { OldSpace, OldSpaceSchema } from './schemas/old-space.schema';
import {
  OldUser,
  OldUserData,
  OldUserDataSchema,
  OldUserSchema,
} from './schemas/old-user.schema';
import {
  OldTransaction,
  OldTransactionSchema,
} from './schemas/old-transaction.schema';
import {
  OldEntity,
  OldEntitySchema,
  OldTgChat,
  OldTgChatSchema,
} from './schemas/old-tg-chat.schema';
import {
  OldPublication,
  OldPublicationSchema,
} from './schemas/old-publication.schema';

import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { AssetsModule } from '@common/abstracts/assets/assets.module';
import { AgreementsModule } from '@common/abstracts/agreements/agreements.module';

const sourceDataConnectionName = 'remote-prod';

process.env.MONGO_CONNECTION_NAME = 'remote-prod-new';

describe('MigrationsService', () => {
  let service: MigrationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MigrationsService],

      imports: [
        DatabaseTestModule,

        MongooseModule.forFeature(
          [
            { name: OldWallet.name, schema: OldWalletSchema },
            { name: OldSpace.name, schema: OldSpaceSchema },
            { name: OldUser.name, schema: OldUserSchema },
            { name: OldUserData.name, schema: OldUserDataSchema },
            { name: OldTransaction.name, schema: OldTransactionSchema },
            { name: OldTgChat.name, schema: OldTgChatSchema },
            { name: OldPublication.name, schema: OldPublicationSchema },
            { name: OldEntity.name, schema: OldEntitySchema },
          ],
          'remote-prod',
        ),
        ActorsModule,
        AssetsModule,
        CountersModule,
        AgreementsModule,
      ],
    }).compile();

    service = module.get<MigrationsService>(MigrationsService);
  });

  it('should be defined', async () => {
    /* await service.wipeActors();
    await service.wipeAssets();
    await service.wipeCounters();
    await service.wipeAgreements();
    await service.migrateTgChats();
    await service.migrateEntities();

    await service.migrateUsers();
    await service.migrateUserDatas();

    await service.migrateSpaces();
    await service.migratePublications();
    await service.migrateWallets();
    await service.migrateTransactions();

    */
    // Using mock test chat IDs
    await service.changeTgChatId('-100000001', '-100000002');
    expect(service).toBeDefined();
  });
});
