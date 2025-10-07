import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { CountersService } from '@common/abstracts/counters/counters.service';
import { libsDatabaseConnectionName } from '@common/abstracts/helpers/database/config';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Counter.name, schema: CounterSchema }],
      libsDatabaseConnectionName,
    ),
  ],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
