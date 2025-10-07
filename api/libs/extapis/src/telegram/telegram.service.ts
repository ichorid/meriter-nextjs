import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  async getUserRole(botUsername, tgChatId, tgUserId) {
    return 'admin';
  }
}
