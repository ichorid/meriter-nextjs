import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersModule as LegacyUsersModule } from '../../users/users.module';
import { TgChatsModule } from '../../tg-chats/tg-chats.module';

@Module({
  imports: [LegacyUsersModule, TgChatsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
