import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressSchema,
} from '../models/tappalka/tappalka-progress.schema';
import {
  TappalkaSessionSchemaClass,
  TappalkaSessionSchema,
} from '../models/tappalka/tappalka-session.schema';
import { TappalkaService } from './tappalka.service';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [
    DomainModule, // Import DomainModule to access other services (MeritService, WalletService, etc.)
    MongooseModule.forFeature([
      { name: TappalkaProgressSchemaClass.name, schema: TappalkaProgressSchema },
      { name: TappalkaSessionSchemaClass.name, schema: TappalkaSessionSchema },
    ]),
  ],
  providers: [TappalkaService],
  exports: [TappalkaService],
})
export class TappalkaModule {}


