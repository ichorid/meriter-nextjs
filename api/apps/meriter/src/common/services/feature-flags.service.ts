import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/**
 * Centralized service for checking feature flags
 * All Telegram-related feature checks should go through this service
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  /**
   * Check if Telegram bot functionality is enabled
   * Returns true only if TELEGRAM_BOT_ENABLED is explicitly set to 'true'
   */
  isTelegramBotEnabled(): boolean {
    return this.configService.get('features')?.telegramBotEnabled ?? false;
  }

  /**
   * Check if Telegram authentication is enabled
   * Returns true only if OAUTH_TELEGRAM_ENABLED is explicitly set to 'true'
   */
  isTelegramAuthEnabled(): boolean {
    return this.configService.get('features')?.telegramAuthEnabled ?? false;
  }
}

