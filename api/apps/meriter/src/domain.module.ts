import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import { Publication, PublicationSchema } from '../domain/models/publication/publication.schema';
import { Comment, CommentSchema } from '../domain/models/comment/comment.schema';
import { Vote, VoteSchema } from '../domain/models/vote/vote.schema';
import { Poll, PollSchema } from '../domain/models/poll/poll.schema';
import { PollVote, PollVoteSchema } from '../domain/models/poll/poll-vote.schema';
import { Wallet, WalletSchema } from '../domain/models/wallet/wallet.schema';
import { User, UserSchema } from '../domain/models/user/user.schema';
import { Community, CommunitySchema } from '../domain/models/community/community.schema';
import { Transaction, TransactionSchema } from '../domain/models/transaction/transaction.schema';

// Import repositories (only those with valuable logic)
import { PublicationRepository } from '../domain/models/publication/publication.repository';
import { CommentRepository } from '../domain/models/comment/comment.repository';
import { VoteRepository } from '../domain/models/vote/vote.repository';
import { PollVoteRepository } from '../domain/models/poll/poll-vote.repository';
import { WalletRepository } from '../domain/models/wallet/wallet.repository';
import { TransactionRepository } from '../domain/models/transaction/transaction.repository';

// Import V1 services (keep for backwards compatibility)
import { PublicationService } from '../domain/services/publication.service';
import { CommentService } from '../domain/services/comment.service';
import { VoteService } from '../domain/services/vote.service';
import { PollVoteService } from '../domain/services/poll-vote.service';
import { WalletService } from '../domain/services/wallet.service';

// Import V2 services (rich domain with transactions)
import { PublicationServiceV2 } from '../domain/services/publication.service-v2';
import { CommentServiceV2 } from '../domain/services/comment.service-v2';
import { PollServiceV2 } from '../domain/services/poll.service-v2';
import { WalletServiceV2 } from '../domain/services/wallet.service-v2';

// Import Telegram services
import { TelegramBotLifecycleService } from '../telegram/bot-lifecycle.service';
import { TelegramMessageProcessorService } from '../telegram/message-processor.service';
import { TelegramPublicationCreatorService } from '../telegram/publication-creator.service';
import { TelegramFileHandlerService } from '../telegram/file-handler.service';
import { BeneficiaryParserService } from '../telegram/beneficiary-parser.service';

// Import controllers
import { PublicationsController } from '../api-v1/publications/publications.controller';
import { CommentsController } from '../api-v1/controllers/comments.controller';
import { VotesController } from '../api-v1/controllers/votes.controller';
import { PollsController } from '../api-v1/controllers/polls.controller';
import { WalletsController } from '../api-v1/controllers/wallets.controller';

// Import event bus
import { EventBus } from '../domain/events/event-bus';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Publication.name, schema: PublicationSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: Poll.name, schema: PollSchema },
      { name: PollVote.name, schema: PollVoteSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: User.name, schema: UserSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [
    // Repositories (only those with valuable logic)
    PublicationRepository,
    CommentRepository,
    VoteRepository,
    PollVoteRepository,
    WalletRepository,
    TransactionRepository,
    
    // V1 services (for backwards compatibility)
    PublicationService,
    CommentService,
    VoteService,
    PollVoteService,
    WalletService,
    
    // V2 services (rich domain with transactions)
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    
    // Telegram services
    TelegramBotLifecycleService,
    TelegramMessageProcessorService,
    TelegramPublicationCreatorService,
    TelegramFileHandlerService,
    BeneficiaryParserService,
    
    // Event bus
    EventBus,
  ],
  controllers: [
    PublicationsController,
    CommentsController,
    VotesController,
    PollsController,
    WalletsController,
  ],
  exports: [
    // Export V2 services for use in controllers
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    VoteService,
    
    // Export V1 services (for backwards compatibility)
    PublicationService,
    CommentService,
    VoteService,
    PollVoteService,
    WalletService,
    
    // Export Telegram services
    TelegramBotLifecycleService,
    TelegramMessageProcessorService,
    TelegramPublicationCreatorService,
    TelegramFileHandlerService,
    BeneficiaryParserService,
    
    // Export repositories
    PublicationRepository,
    CommentRepository,
    VoteRepository,
    PollVoteRepository,
    WalletRepository,
    TransactionRepository,
    
    // Export event bus
    EventBus,
  ],
})
export class DomainModule {}
