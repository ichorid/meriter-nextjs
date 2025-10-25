import { Module } from '@nestjs/common';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [PublicationsController],
  providers: [PublicationsService],
})
export class PublicationsModule {}
