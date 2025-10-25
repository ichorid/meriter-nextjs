import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [DomainModule, TgBotsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
