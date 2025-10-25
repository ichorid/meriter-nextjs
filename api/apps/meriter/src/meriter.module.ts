import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

import { join } from 'path';

import { ApiV1Module } from './api-v1/api-v1.module';
import { DatabaseModule } from './common/database/database.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

import { TelegramHookController } from './tg-bots/hook/hook.controller';
import { UpdatesConductorsService } from './updates-conductors/updates-conductors.service';
import { UpdatesConductorsModule } from './updates-conductors/updates-conductors.module';
import { TgBotsModule } from './tg-bots/tg-bots.module';

// Import the new domain module
import { DomainModule } from './domain.module';

// Import legacy service modules
import { UsersModule } from './users/users.module';
import { TgChatsModule } from './tg-chats/tg-chats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseModule,
    UsersModule, // Legacy users service
    TgChatsModule, // Legacy tg-chats service
    ApiV1Module,
    DomainModule, // Domain layer with V2 services
    UpdatesConductorsModule,
    TgBotsModule,
  ],
  controllers: [MeriterController, TelegramHookController],
  providers: [MeriterService],
})
export class MeriterModule {}
