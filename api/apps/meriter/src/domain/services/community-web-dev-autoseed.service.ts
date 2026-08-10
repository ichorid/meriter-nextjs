import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { isTelegramMvpMode } from '../../common/helpers/product-mode.helper';
import { CommunityWebDevSeedService } from './community-web-dev-seed.service';

@Injectable()
export class CommunityWebDevAutoseedService implements OnModuleInit {
  private readonly logger = new Logger(CommunityWebDevAutoseedService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly seedService: CommunityWebDevSeedService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.COMMUNITY_WEB_DEV_AUTO_SEED !== 'true') {
      return;
    }

    const env = this.configService.get('app')?.env;
    if (env === 'production') {
      return;
    }

    if (!isTelegramMvpMode(this.configService)) {
      this.logger.warn(
        'COMMUNITY_WEB_DEV_AUTO_SEED is set but MERITER_PRODUCT_MODE is not telegram_mvp — skipping',
      );
      return;
    }

    try {
      await this.seedService.seed({ ifMissingOnly: true });
    } catch (err) {
      this.logger.error(
        `Community-web dev autoseed failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
