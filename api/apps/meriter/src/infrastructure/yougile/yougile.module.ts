import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainModule } from '../../domain.module';
import { OrchestrationWiringModule } from '../../orchestration-wiring.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { URL as APP_URL } from '../../config';
import {
  YougileIntegration,
  YougileIntegrationSchema,
} from '../../domain/models/yougile/yougile-integration.schema';
import {
  YougileProcessedEvent,
  YougileProcessedEventSchema,
} from '../../domain/models/yougile/yougile-processed-event.schema';
import {
  YOUGILE_INTEGRATION_PERSISTENCE_PORT,
  type YougileIntegrationPersistencePort,
} from '../../domain/ports/yougile-integration.persistence.port';
import {
  YOUGILE_API_PORT,
  type YougileApiPort,
} from '../../domain/ports/yougile-api.port';
import {
  CREATE_PUBLICATION_PORT,
  type CreatePublicationPort,
} from '../../domain/ports/create-publication.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../../domain/ports/publication.persistence.port';
import { UserService } from '../../domain/services/user.service';
import { NotificationService } from '../../domain/services/notification.service';
import { CommunityService } from '../../domain/services/community.service';
import {
  createProcessYougileTaskDoneUseCase,
  type ProcessYougileTaskDoneUseCase,
} from '../../application/use-cases/integrations/process-yougile-task-done.use-case';
import { createManageYougileIntegrationUseCase } from '../../application/use-cases/integrations/manage-yougile-integration.use-case';
import { YougileApiClient } from './yougile-api.client';
import { YougileIntegrationPersistenceAdapter } from '../persistence/yougile-integration.persistence.adapter';
import { YougileWebhookController } from './yougile-webhook.controller';
import {
  MANAGE_YOUGILE_INTEGRATION_USE_CASE,
  PROCESS_YOUGILE_TASK_DONE_USE_CASE,
} from './yougile.tokens';

/**
 * YouGile integration composition root (variant A2: task done -> auto-post).
 * Self-contained on purpose: registers its own schemas and providers to keep
 * the merge footprint on shared modules minimal.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: YougileIntegration.name, schema: YougileIntegrationSchema },
      {
        name: YougileProcessedEvent.name,
        schema: YougileProcessedEventSchema,
      },
    ]),
    DomainModule,
    OrchestrationWiringModule,
    PersistenceModule, // PUBLICATION_PERSISTENCE_PORT for the dashboard
  ],
  controllers: [YougileWebhookController],
  providers: [
    YougileApiClient,
    { provide: YOUGILE_API_PORT, useExisting: YougileApiClient },
    YougileIntegrationPersistenceAdapter,
    {
      provide: YOUGILE_INTEGRATION_PERSISTENCE_PORT,
      useExisting: YougileIntegrationPersistenceAdapter,
    },
    {
      provide: PROCESS_YOUGILE_TASK_DONE_USE_CASE,
      useFactory: (
        integrationPersistence: YougileIntegrationPersistencePort,
        yougileApi: YougileApiPort,
        userService: UserService,
        createPublication: CreatePublicationPort,
        notificationService: NotificationService,
      ) =>
        createProcessYougileTaskDoneUseCase({
          integrationPersistence,
          yougileApi,
          userService,
          createPublication,
          notificationService,
          appUrl: APP_URL,
        }),
      inject: [
        YOUGILE_INTEGRATION_PERSISTENCE_PORT,
        YOUGILE_API_PORT,
        UserService,
        CREATE_PUBLICATION_PORT,
        NotificationService,
      ],
    },
    {
      provide: MANAGE_YOUGILE_INTEGRATION_USE_CASE,
      useFactory: (
        integrationPersistence: YougileIntegrationPersistencePort,
        yougileApi: YougileApiPort,
        communityService: CommunityService,
        userService: UserService,
        publicationPersistence: PublicationPersistencePort,
        processTaskDone: ProcessYougileTaskDoneUseCase,
      ) =>
        createManageYougileIntegrationUseCase({
          integrationPersistence,
          yougileApi,
          communityService,
          userService,
          publicationPersistence,
          processTaskDone,
          appUrl: APP_URL,
        }),
      inject: [
        YOUGILE_INTEGRATION_PERSISTENCE_PORT,
        YOUGILE_API_PORT,
        CommunityService,
        UserService,
        PUBLICATION_PERSISTENCE_PORT,
        PROCESS_YOUGILE_TASK_DONE_USE_CASE,
      ],
    },
  ],
  exports: [
    YOUGILE_API_PORT,
    YOUGILE_INTEGRATION_PERSISTENCE_PORT,
    PROCESS_YOUGILE_TASK_DONE_USE_CASE,
    MANAGE_YOUGILE_INTEGRATION_USE_CASE,
  ],
})
export class YougileModule {}
