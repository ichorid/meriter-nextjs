import { Module } from '@nestjs/common';
import { AbstractsService } from './abstracts.service';
import { TransactionsService } from './transactions/transactions.service';

import { ActorsService } from './actors/actors.service';
import { ProtosService } from './protos/protos.service';
import { AssetsService } from './assets/assets.service';
import { TicketsService } from './tickets/tickets.service';

import { MongooseModule } from '@nestjs/mongoose';

import { AssetsModule } from './assets/assets.module';
import { CountersService } from './counters/counters.service';
import { CountersModule } from './counters/counters.module';
import { AuthModule } from './helpers/auth/auth.module';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { ActorsModule } from './actors/actors.module';
import { AgreementsService } from './agreements/agreements.service';
import { AgreementsModule } from './agreements/agreements.module';

@Module({
  imports: [AssetsModule, CountersModule, AuthModule, ActorsModule, AgreementsModule],
  providers: [
    AbstractsService,
    TransactionsService,
    ActorsService,
    ProtosService,
    TicketsService,
    CountersService,
    AgreementsService,
  ],
  exports: [AbstractsService],
})
export class AbstractsModule {}
