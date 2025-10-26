import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DomainModule } from '../../domain.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';
import { Community, CommunitySchema } from '../../domain/models/community/community.schema';

@Module({
  imports: [
    DomainModule,
    TgBotsModule,
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema }
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
