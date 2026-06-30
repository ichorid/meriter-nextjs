import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainModule } from '../../domain.module';
import { CommonServicesModule } from '../../common/services/common-services.module';
import { OrchestrationWiringModule } from '../../orchestration-wiring.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { UserSchemaClass, UserSchema } from '../../domain/models/user/user.schema';
import { CommunitySchemaClass, CommunitySchema } from '../../domain/models/community/community.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorSchema,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import {
  TelegramBotPendingActionSchemaClass,
  TelegramBotPendingActionSchema,
} from '../../domain/models/telegram/telegram-bot-pending-action.schema';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBotOrchestratorService } from './telegram-bot.orchestrator.service';
import { TelegramPublicationMirrorHandler } from './telegram-publication-mirror.handler';
import { TelegramMeritTransferGroupNotifier } from './telegram-merit-transfer-group-notifier.service';
import { MERIT_TRANSFER_GROUP_NOTIFY_PORT } from '../../domain/ports/merit-transfer-group-notify.port';

/**
 * BC-19 Telegram infrastructure composition root (Phase 8 / OD-4).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSchemaClass.name, schema: UserSchema },
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: TelegramPublicationAnchorSchemaClass.name, schema: TelegramPublicationAnchorSchema },
      { name: TelegramBotPendingActionSchemaClass.name, schema: TelegramBotPendingActionSchema },
    ]),
    DomainModule,
    CommonServicesModule,
    OrchestrationWiringModule,
    PersistenceModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TgBotsService,
    TelegramBotOrchestratorService,
    TelegramPublicationMirrorHandler,
    TelegramMeritTransferGroupNotifier,
    {
      provide: MERIT_TRANSFER_GROUP_NOTIFY_PORT,
      useExisting: TelegramMeritTransferGroupNotifier,
    },
  ],
  exports: [
    TgBotsService,
    TelegramBotOrchestratorService,
    MERIT_TRANSFER_GROUP_NOTIFY_PORT,
  ],
})
export class TelegramInfrastructureModule {}
