import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UpdatesConductor,
  UpdatesConductorSchema,
} from './model/updates-conductor.schema';
import { UpdatesConductorsService } from './updates-conductors.service';

import { TgChatsModule } from '../tg-chats/tg-chats.module';
import { TgBotsModule } from '../tg-bots/tg-bots.module';
import { DatabaseModule } from '@common/abstracts/helpers/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature(
      [{ name: UpdatesConductor.name, schema: UpdatesConductorSchema }],
      'remote-prod-2',
    ),
    TgChatsModule,
    TgBotsModule,
  ],
  providers: [UpdatesConductorsService],
  exports: [UpdatesConductorsService],
})
export class UpdatesConductorsModule {}
