import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { CommentsModule } from './comments/comments.module';
import { VotesModule } from './votes/votes.module';
import { PollsModule } from './polls/polls.module';
import { WalletsModule } from './wallets/wallets.module';
import { UsersModule } from './users/users.module';
import { ApiV1ConfigModule } from './config/config.module';

@Module({
  imports: [
    AuthModule,
    CommunitiesModule,
    CommentsModule,
    VotesModule,
    PollsModule,
    WalletsModule,
    UsersModule,
    ApiV1ConfigModule,
  ],
})
export class ApiV1Module {}
