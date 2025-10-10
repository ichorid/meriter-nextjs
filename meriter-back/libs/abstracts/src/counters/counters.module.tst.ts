import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';

@Module({
  imports: [
    DatabaseTestModule,
    MongooseModule.forFeature(
      [{ name: Counter.name, schema: CounterSchema }],
      'local-test',
    ),
  ],
})
export class CountersModuleTst {}
