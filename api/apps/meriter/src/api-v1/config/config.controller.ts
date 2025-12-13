import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig() {
    // Get BOT_USERNAME from environment (optional)
    const botUsername = process.env.BOT_USERNAME?.trim() || null;

    // Return in standard API response format
    // ApiResponseInterceptor will wrap this automatically
    // botUsername is optional - Telegram bot is not required
    return {
      botUsername,
    };
  }
}

