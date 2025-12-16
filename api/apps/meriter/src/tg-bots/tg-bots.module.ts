import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TgBotsService } from './tg-bots.service';
import { UserSchemaClass, UserSchema } from '../domain/models/user/user.schema';
import { PublicationSchemaClass, PublicationSchema } from '../domain/models/publication/publication.schema';
import { CommunitySchemaClass, CommunitySchema } from '../domain/models/community/community.schema';
import { DomainModule } from '../domain.module';
import { CommonServicesModule } from '../common/services/common-services.module';

/**
 * Telegram Bots Module
 * Conditionally registered based on TELEGRAM_BOT_ENABLED feature flag
 * Provides Telegram bot functionality (notifications, message reading, webhooks)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSchemaClass.name, schema: UserSchema },
      { name: PublicationSchemaClass.name, schema: PublicationSchema },
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
    ]),
    DomainModule,
    CommonServicesModule,
  ],
  providers: [TgBotsService],
  exports: [TgBotsService],
})
export class TgBotsModule {}

