import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TgBotsService } from './tg-bots.service';
import { BeneficiaryParserService } from '../telegram/beneficiary-parser.service';
import { TelegramBotLifecycleService } from '../telegram/bot-lifecycle.service';
import { TelegramFileHandlerService } from '../telegram/file-handler.service';
import { TelegramMessageProcessorService } from '../telegram/message-processor.service';
import { TelegramPublicationCreatorService } from '../telegram/publication-creator.service';
import { DomainModule } from '../domain.module';
import { User, UserSchema } from '../domain/models/user/user.schema';
import { Publication, PublicationSchema } from '../domain/models/publication/publication.schema';
import { Community, CommunitySchema } from '../domain/models/community/community.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Publication.name, schema: PublicationSchema },
      { name: Community.name, schema: CommunitySchema },
    ]),
  ],
  providers: [
    TgBotsService,
    BeneficiaryParserService,
    TelegramBotLifecycleService,
    TelegramFileHandlerService,
    TelegramMessageProcessorService,
    TelegramPublicationCreatorService,
  ],
  exports: [TgBotsService],
})
export class TgBotsModule {}
