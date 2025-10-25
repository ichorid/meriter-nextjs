import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import { Publication, PublicationSchema } from './domain/models/publication/publication.schema';
import { Comment, CommentSchema } from './domain/models/comment/comment.schema';
import { Vote, VoteSchema } from './domain/models/vote/vote.schema';
import { Poll, PollSchema } from './domain/models/poll/poll.schema';
import { PollVote, PollVoteSchema } from './domain/models/poll/poll-vote.schema';
import { Wallet, WalletSchema } from './domain/models/wallet/wallet.schema';
import { User, UserSchema } from './domain/models/user/user.schema';
import { Community, CommunitySchema } from './domain/models/community/community.schema';
import { Transaction, TransactionSchema } from './domain/models/transaction/transaction.schema';

// Import repositories (only those with valuable logic)
import { PublicationRepository } from './domain/models/publication/publication.repository';
import { CommentRepository } from './domain/models/comment/comment.repository';
import { VoteRepository } from './domain/models/vote/vote.repository';
import { PollVoteRepository } from './domain/models/poll/poll-vote.repository';
import { WalletRepository } from './domain/models/wallet/wallet.repository';
import { TransactionRepository } from './domain/models/transaction/transaction.repository';
import { UserRepository } from './domain/models/user/user.repository';
import { CommunityRepository } from './domain/models/community/community.repository';
import { PollRepository } from './domain/models/poll/poll.repository';

// Import V2 services (rich domain with transactions)
import { PublicationServiceV2 } from './domain/services/publication.service-v2';
import { CommentServiceV2 } from './domain/services/comment.service-v2';
import { PollServiceV2 } from './domain/services/poll.service-v2';
import { WalletServiceV2 } from './domain/services/wallet.service-v2';
import { VoteService } from './domain/services/vote.service';
import { PollVoteService } from './domain/services/poll-vote.service';

// Import event bus
import { EventBus } from './domain/events/event-bus';

@Module({
  imports: [
    // Mongoose schemas
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
    // Repositories
    PublicationRepository,
    CommentRepository,
    VoteRepository,
    PollVoteRepository,
    WalletRepository,
    TransactionRepository,
    UserRepository,
    CommunityRepository,
    PollRepository,
    
    // V2 Services
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    VoteService,
    PollVoteService,
    
    // Event bus
    EventBus,
  ],
  exports: [
    // Export repositories
    PublicationRepository,
    CommentRepository,
    VoteRepository,
    PollVoteRepository,
    WalletRepository,
    TransactionRepository,
    UserRepository,
    CommunityRepository,
    PollRepository,
    
    // Export V2 services
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    VoteService,
    PollVoteService,
    
    // Export event bus
    EventBus,
  ],
})
export class DomainModule {}