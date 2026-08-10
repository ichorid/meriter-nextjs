import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../config/configuration';
import { isTelegramMvpMode } from '../../../common/helpers/product-mode.helper';
import {
  CommunityWebDevSeedService,
  type CommunityWebDevSeedResult,
} from '../../../domain/services/community-web-dev-seed.service';

export type SeedCommunityWebDevInput = {
  ifMissingOnly?: boolean;
  forceContent?: boolean;
  /** When true, skip COMMUNITY_WEB_DEV_AUTO_SEED env check (CLI). */
  explicit?: boolean;
};

@Injectable()
export class SeedCommunityWebDevUseCase {
  private readonly logger = new Logger(SeedCommunityWebDevUseCase.name);

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly seedService: CommunityWebDevSeedService,
  ) {}

  static assertAllowed(
    configService: ConfigService<AppConfig>,
    options?: Pick<SeedCommunityWebDevInput, 'explicit'>,
  ): void {
    const env = configService.get('app')?.env;
    if (env === 'production') {
      throw new BadRequestException(
        'Community-web dev seed is not allowed in production',
      );
    }
    if (!isTelegramMvpMode(configService)) {
      throw new BadRequestException(
        'Community-web dev seed requires MERITER_PRODUCT_MODE=telegram_mvp',
      );
    }
    if (
      !options?.explicit &&
      process.env.COMMUNITY_WEB_DEV_AUTO_SEED !== 'true'
    ) {
      throw new BadRequestException(
        'Community-web dev seed requires COMMUNITY_WEB_DEV_AUTO_SEED=true or explicit CLI invocation',
      );
    }
  }

  async execute(
    input: SeedCommunityWebDevInput = {},
  ): Promise<CommunityWebDevSeedResult> {
    SeedCommunityWebDevUseCase.assertAllowed(this.configService, {
      explicit: input.explicit,
    });

    this.logger.log(
      `Running community-web dev seed (ifMissingOnly=${Boolean(input.ifMissingOnly)}, forceContent=${Boolean(input.forceContent)})`,
    );

    return this.seedService.seed({
      ifMissingOnly: input.ifMissingOnly,
      forceContent: input.forceContent,
    });
  }
}
