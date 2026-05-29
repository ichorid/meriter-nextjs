import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainModule } from '../../domain.module';
import { CommonServicesModule } from '../../common/services/common-services.module';
import { UserSchemaClass, UserSchema } from '../../domain/models/user/user.schema';
import { CommunitySchemaClass, CommunitySchema } from '../../domain/models/community/community.schema';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import { TelegramWebhookController } from './telegram-webhook.controller';

/**
 * BC-19 Telegram infrastructure composition root (Phase 8 / OD-4).
 *
 * Registers webhook controller and TgBotsService with PublicationService ingress.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSchemaClass.name, schema: UserSchema },
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
    ]),
    DomainModule,
    CommonServicesModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [TgBotsService],
  exports: [TgBotsService],
})
export class TelegramInfrastructureModule {}
