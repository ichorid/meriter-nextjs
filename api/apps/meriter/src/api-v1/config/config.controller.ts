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

    // OAuth provider flags - read from environment variables
    const oauth = {
      google: process.env.OAUTH_GOOGLE_ENABLED === 'true',
      yandex: process.env.OAUTH_YANDEX_ENABLED === 'true',
      vk: process.env.OAUTH_VK_ENABLED === 'true',
      telegram: process.env.OAUTH_TELEGRAM_ENABLED === 'true',
      apple: process.env.OAUTH_APPLE_ENABLED === 'true',
      twitter: process.env.OAUTH_TWITTER_ENABLED === 'true',
      instagram: process.env.OAUTH_INSTAGRAM_ENABLED === 'true',
      sber: process.env.OAUTH_SBER_ENABLED === 'true',
      mailru: process.env.OAUTH_MAILRU_ENABLED === 'true',
    };

    // AUTHN (WebAuthn/Passkey) flag
    const authn = {
      enabled: process.env.AUTHN_ENABLED === 'true',
    };

    // Feature flags
    const features = {
      analytics: process.env.ENABLE_ANALYTICS === 'true' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
      debug: process.env.ENABLE_DEBUG === 'true' || process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true',
      commentVoting: process.env.ENABLE_COMMENT_VOTING === 'true' || process.env.NEXT_PUBLIC_ENABLE_COMMENT_VOTING === 'true',
      commentImageUploads: process.env.ENABLE_COMMENT_IMAGE_UPLOADS === 'true' || process.env.NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS === 'true',
      loginInviteForm: process.env.ENABLE_LOGIN_INVITE_FORM === 'true' || process.env.NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM === 'true',
    };

    // Return in standard API response format
    // ApiResponseInterceptor will wrap this automatically
    return {
      botUsername,
      oauth,
      authn,
      features,
    };
  }
}

