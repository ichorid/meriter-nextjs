import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressSchema,
} from '../models/tappalka/tappalka-progress.schema';
import { TappalkaService } from './tappalka.service';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [
    DomainModule, // Import DomainModule to access other services (MeritService, WalletService, etc.)
    MongooseModule.forFeature([
      { name: TappalkaProgressSchemaClass.name, schema: TappalkaProgressSchema },
    ]),
  ],
  providers: [TappalkaService],
  exports: [TappalkaService],
})
export class TappalkaModule {}


