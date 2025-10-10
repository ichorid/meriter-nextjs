import { Controller, Get, Query } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';

// Helper function to map TgChat to old format for API backward compatibility
function mapTgChatToOldFormat(chat: any) {
  if (!chat) return null;
  return {
    _id: chat.uid,
    photo: chat.profile?.avatarUrl,
    title: chat.profile?.name,
    description: chat.profile?.description,
    icon: chat.meta?.iconUrl,
    chatId: chat.identities?.[0]?.replace('telegram://', ''),
    tags: chat.meta?.hashtagLabels || [],
    url: chat.meta?.url,
    helpUrl: chat.meta?.helpUrl,
  };
}

@Controller('api/rest/getchat')
export class GetchatController {
  constructor(private tgChatsService: TgChatsService) {}
  @Get()
  async rest_getchat(@Query('chatId') chatId: string) {
    const info = await this.tgChatsService.getInfo(chatId);
    if (!info) return {};
    return { chat: mapTgChatToOldFormat(info) };
  }
}
