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
import {
  TelegramChatMemberDirectorySchemaClass,
  TelegramChatMemberDirectorySchema,
} from '../../domain/models/telegram/telegram-chat-member-directory.schema';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBotOrchestratorService } from './telegram-bot.orchestrator.service';
import { TelegramCommunityChatResolver } from './telegram-community-chat.resolver';
import { TelegramPublicationMirrorHandler } from './telegram-publication-mirror.handler';
import { TelegramPollAnnounceHandler } from './telegram-poll-announce.handler';
import { TelegramPollResultsCron } from './telegram-poll-results.cron';
import { TelegramMeritTransferGroupNotifier } from './telegram-merit-transfer-group-notifier.service';
import { UzzTelegramNotifyHandler } from './uzz-telegram-notify.handler';
import { MERIT_TRANSFER_GROUP_NOTIFY_PORT } from '../../domain/ports/merit-transfer-group-notify.port';
import { DeliverUzzOutboxUseCase } from '../../application/uzz/use-cases/deliver-uzz-outbox.use-case';
import { UZZ_UNIT_OF_WORK, UzzUnitOfWork } from '../../application/uzz/ports/uzz-unit-of-work';
import { SYSTEM_CLOCK } from '../../application/uzz/ports/clock.port';
import { TelegramUzzNotificationSender } from '../uzz/notifications/telegram-uzz-notification.sender';
import { UzzOutboxCronEntrypoint } from '../cron/uzz-outbox.cron';

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
      {
        name: TelegramChatMemberDirectorySchemaClass.name,
        schema: TelegramChatMemberDirectorySchema,
      },
    ]),
    DomainModule,
    CommonServicesModule,
    OrchestrationWiringModule,
    PersistenceModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [
    TgBotsService,
    TelegramCommunityChatResolver,
    TelegramBotOrchestratorService,
    TelegramPublicationMirrorHandler,
    TelegramPollAnnounceHandler,
    TelegramPollResultsCron,
    TelegramMeritTransferGroupNotifier,
    UzzTelegramNotifyHandler,
    TelegramUzzNotificationSender,
    {
      provide: DeliverUzzOutboxUseCase,
      inject: [UZZ_UNIT_OF_WORK, TelegramUzzNotificationSender],
      useFactory: (unitOfWork: UzzUnitOfWork, sender: TelegramUzzNotificationSender) =>
        new DeliverUzzOutboxUseCase(unitOfWork, sender, SYSTEM_CLOCK),
    },
    UzzOutboxCronEntrypoint,
    {
      provide: MERIT_TRANSFER_GROUP_NOTIFY_PORT,
      useExisting: TelegramMeritTransferGroupNotifier,
    },
  ],
  exports: [
    TgBotsService,
    TelegramCommunityChatResolver,
    TelegramBotOrchestratorService,
    MERIT_TRANSFER_GROUP_NOTIFY_PORT,
  ],
})
export class TelegramInfrastructureModule {}
