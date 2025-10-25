import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../../users/users.module';
import { TgChatsModule } from '../../tg-chats/tg-chats.module';
import { TgBotsModule } from '../../tg-bots/tg-bots.module';

@Module({
  imports: [UsersModule, TgChatsModule, TgBotsModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
