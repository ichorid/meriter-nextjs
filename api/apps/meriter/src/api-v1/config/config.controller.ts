import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig() {
    // Get BOT_USERNAME from environment
    const botUsername = process.env.BOT_USERNAME;

    // Fail fast - no fallbacks
    if (!botUsername || botUsername.trim() === '') {
      this.logger.error('BOT_USERNAME environment variable is not set or is empty');
      throw new HttpException(
        {
          code: 'CONFIG_ERROR',
          message: 'BOT_USERNAME is not configured',
          details: {
            message: 'BOT_USERNAME environment variable is required but not set',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Return in standard API response format
    // ApiResponseInterceptor will wrap this automatically
    return {
      botUsername,
    };
  }
}

