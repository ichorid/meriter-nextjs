import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';
import { ApiV1CommonModule } from '../common/common.module';

@Module({
  imports: [DomainModule, TgBotsModule, ApiV1CommonModule],
  controllers: [CommentsController],
})
export class CommentsModule {}
