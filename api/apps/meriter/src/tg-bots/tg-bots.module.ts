import { Module } from '@nestjs/common';
import { TgBotsService } from './tg-bots.service';
import { BeneficiaryParserService } from '../telegram/beneficiary-parser.service';
import { BotLifecycleService } from '../telegram/bot-lifecycle.service';
import { FileHandlerService } from '../telegram/file-handler.service';
import { MessageProcessorService } from '../telegram/message-processor.service';
import { PublicationCreatorService } from '../telegram/publication-creator.service';
import { DomainModule } from '../domain.module';

@Module({
  imports: [DomainModule],
  providers: [
    TgBotsService,
    BeneficiaryParserService,
    BotLifecycleService,
    FileHandlerService,
    MessageProcessorService,
    PublicationCreatorService,
  ],
  exports: [TgBotsService],
})
export class TgBotsModule {}
