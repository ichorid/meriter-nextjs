import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletsController } from './wallets.controller';
import { DomainModule } from '../../domain.module';
import { Community, CommunitySchema } from '../../domain/models/community/community.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
    ]),
  ],
  controllers: [WalletsController],
})
export class WalletsModule {}
