import { Module } from '@nestjs/common';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';
import { PublicationsService as LegacyPublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';

@Module({
  controllers: [PublicationsController],
  providers: [
    PublicationsService,
    LegacyPublicationsService,
    TgBotsService,
  ],
})
export class PublicationsModule {}
