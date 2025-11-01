import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletsController } from './wallets.controller';
import { DomainModule } from '../../domain.module';
import { Community, CommunitySchema } from '../../domain/models/community/community.schema';
import { User, UserSchema } from '../../domain/models/user/user.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WalletsController],
})
export class WalletsModule {}
