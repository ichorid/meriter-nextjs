import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { PublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';

@Module({
  controllers: [CommentsController],
  providers: [
    CommentsService,
    TransactionsService,
    PublicationsService,
    TgBotsService,
  ],
})
export class CommentsModule {}
