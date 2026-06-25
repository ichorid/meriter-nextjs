import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export function isTelegramMvpMode(
  configService: ConfigService<AppConfig>,
): boolean {
  return configService.get('app')?.productMode === 'telegram_mvp';
}

export function getCommunityWebBaseUrl(
  configService: ConfigService<AppConfig>,
): string {
  const configured = configService.get('app')?.communityWebBaseUrl;
  if (configured) return configured.replace(/\/$/, '');
  return 'https://community.meriter.pro';
}
