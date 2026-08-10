import type { ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';
import type { AppConfig } from '../../../config/configuration';
import { CommunitySchemaClass } from '../../../domain/models/community/community.schema';
import { TelegramPublicationAnchorSchemaClass } from '../../../domain/models/telegram/telegram-publication-anchor.schema';
import {
  createTelegramPublicationModerationUseCase,
  type TelegramPublicationModerationUseCase,
} from '../../../application/use-cases/publications/telegram-publication-moderation.use-case';

type TrpcModerationContext = {
  user: { id: string };
  connection: Connection;
  publicationService: Parameters<
    typeof createTelegramPublicationModerationUseCase
  >[0]['publicationService'];
  communityService: Parameters<
    typeof createTelegramPublicationModerationUseCase
  >[0]['communityService'];
  userService: Parameters<
    typeof createTelegramPublicationModerationUseCase
  >[0]['userService'];
  configService: ConfigService<AppConfig>;
  userEnrichmentService: {
    batchFetchUsers(ids: string[]): Promise<Map<string, unknown>>;
  };
  communityEnrichmentService: {
    batchFetchCommunities(ids: string[]): Promise<Map<string, unknown>>;
  };
};

export function createTelegramModerationUseCaseFromContext(
  ctx: TrpcModerationContext,
): TelegramPublicationModerationUseCase {
  return createTelegramPublicationModerationUseCase({
    publicationService: ctx.publicationService,
    communityService: ctx.communityService,
    userService: ctx.userService,
    configService: ctx.configService,
    communityModel: ctx.connection.model(CommunitySchemaClass.name),
    anchorModel: ctx.connection.model(TelegramPublicationAnchorSchemaClass.name),
    batchFetchUsers: (ids) => ctx.userEnrichmentService.batchFetchUsers(ids),
    batchFetchCommunities: (ids) =>
      ctx.communityEnrichmentService.batchFetchCommunities(ids),
  });
}
