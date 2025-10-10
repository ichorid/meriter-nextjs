import { Body, Controller, Post } from '@nestjs/common';

@Controller('tg-bots')
export class TgBotsController {
  @Post('webhook')
  processWebhook(@Body() body) {
    console.log('recieved webhook',JSON.stringify(body,null,2));
    return 'ok';
  }
}
