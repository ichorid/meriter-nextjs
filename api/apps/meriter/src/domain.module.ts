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
import { PollVoteRepository } from './domain/models/poll/poll-vote.repository';

// Import V2 services (rich domain with transactions)
import { PublicationServiceV2 } from './domain/services/publication.service-v2';
import { CommentServiceV2 } from './domain/services/comment.service-v2';
import { PollServiceV2 } from './domain/services/poll.service-v2';
import { WalletServiceV2 } from './domain/services/wallet.service-v2';
import { VoteService } from './domain/services/vote.service';
import { PollVoteService } from './domain/services/poll-vote.service';
import { UserServiceV2 } from './domain/services/user.service-v2';
import { CommunityServiceV2 } from './domain/services/community.service-v2';

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
    // Repositories (only those with valuable logic)
    PollVoteRepository,
    
    // V2 Services
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    VoteService,
    PollVoteService,
    UserServiceV2,
    CommunityServiceV2,
    
    // Event bus
    EventBus,
  ],
  exports: [
    // Export repositories (only those with valuable logic)
    PollVoteRepository,
    
    // Export V2 services
    PublicationServiceV2,
    CommentServiceV2,
    PollServiceV2,
    WalletServiceV2,
    VoteService,
    PollVoteService,
    UserServiceV2,
    CommunityServiceV2,
    
    // Export event bus
    EventBus,
  ],
})
export class DomainModule {}