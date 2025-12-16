import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletsController } from './wallets.controller';
import { DomainModule } from '../../domain.module';
import { CommunitySchemaClass, CommunitySchema } from '../../domain/models/community/community.schema';
import { UserSchemaClass, UserSchema } from '../../domain/models/user/user.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: UserSchemaClass.name, schema: UserSchema },
    ]),
  ],
  controllers: [WalletsController],
})
export class WalletsModule {}
