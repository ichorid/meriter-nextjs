import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '../../domain/events/event-bus';
import { PublicationCreatedEvent } from '../../domain/events';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { MirrorPublicationToTelegramUseCase } from '../../application/use-cases/publications/mirror-publication-to-telegram.use-case';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class TelegramPublicationMirrorHandler implements OnModuleInit {
  private readonly logger = new Logger(TelegramPublicationMirrorHandler.name);
  private readonly mirrorUseCase: MirrorPublicationToTelegramUseCase;

  constructor(
    private readonly eventBus: EventBus,
    private readonly publicationService: PublicationService,
    private readonly userService: UserService,
    private readonly configService: ConfigService<AppConfig>,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(TelegramPublicationAnchorSchemaClass.name)
    private readonly anchorModel: Model<TelegramPublicationAnchorDocument>,
  ) {
    this.mirrorUseCase = new MirrorPublicationToTelegramUseCase({
      configService: this.configService,
      publicationService: this.publicationService,
      userService: this.userService,
      communityModel: this.communityModel,
      anchorModel: this.anchorModel,
    });
  }

  onModuleInit(): void {
    this.eventBus.subscribe('PublicationCreated', (event) =>
      this.handlePublicationCreated(event as PublicationCreatedEvent),
    );
    this.logger.log('Telegram publication mirror handler registered');
  }

  private async handlePublicationCreated(
    event: PublicationCreatedEvent,
  ): Promise<void> {
    if (event.getSkipTelegramMirror()) {
      return;
    }
    if (this.configService.get('app')?.productMode !== 'telegram_mvp') {
      return;
    }

    try {
      await this.mirrorUseCase.execute(
        event.getAggregateId(),
        event.getCommunityId(),
      );
    } catch (error) {
      this.logger.error(
        `Failed to mirror publication ${event.publicationId} to Telegram`,
        error,
      );
    }
  }
}
