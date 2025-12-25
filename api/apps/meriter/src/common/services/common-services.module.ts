import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { AppConfigService } from './app-config.service';
import { AuthenticationService } from './authentication.service';
import { DomainModule } from '../../domain.module';

/**
 * Common services module
 * Provides shared services like FeatureFlagsService, AppConfigService, and AuthenticationService
 */
@Module({
  imports: [DomainModule], // Provides UserService needed by AuthenticationService
  providers: [FeatureFlagsService, AppConfigService, AuthenticationService],
  exports: [FeatureFlagsService, AppConfigService, AuthenticationService],
})
export class CommonServicesModule {}

