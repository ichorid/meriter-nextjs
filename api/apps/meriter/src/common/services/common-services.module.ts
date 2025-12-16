import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Common services module
 * Provides shared services like FeatureFlagsService
 */
@Module({
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class CommonServicesModule {}

