import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../../users/users.service';
import { TgChatsService } from '../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    TgChatsService,
    TgBotsService,
    ConfigService,
  ],
})
export class AuthModule {}
