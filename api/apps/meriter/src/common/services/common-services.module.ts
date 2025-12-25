import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { AppConfigService } from './app-config.service';

/**
 * Common services module
 * Provides shared services like FeatureFlagsService and AppConfigService
 */
@Module({
  providers: [FeatureFlagsService, AppConfigService],
  exports: [FeatureFlagsService, AppConfigService],
})
export class CommonServicesModule {}

