import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { PublicationsModule } from './publications/publications.module';
import { CommentsModule } from './comments/comments.module';
import { ThanksModule } from './thanks/thanks.module';
import { PollsModule } from './polls/polls.module';
import { WalletsModule } from './wallets/wallets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AuthModule,
    CommunitiesModule,
    PublicationsModule,
    CommentsModule,
    ThanksModule,
    PollsModule,
    WalletsModule,
    UsersModule,
  ],
})
export class ApiV1Module {}
