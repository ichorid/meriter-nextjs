import { Controller, Get, Query } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { successResponse } from '../utils/response.helper';


@Controller('api/rest/getchat')
export class GetchatController {
  constructor(private tgChatsService: TgChatsService) {}
  @Get()
  async rest_getchat(@Query('chatId') chatId: string) {
    const info = await this.tgChatsService.getInfo(chatId);
    if (!info) return successResponse({});
    return successResponse({ chat: info });
  }
}
