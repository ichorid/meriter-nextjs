import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { AppConfigService } from './app-config.service';
import { JwtVerificationService } from './authentication.service';
import { DomainModule } from '../../domain.module';

/**
 * Common services module
 * Provides shared services like FeatureFlagsService, AppConfigService, and JwtVerificationService
 */
@Module({
  imports: [DomainModule], // Provides UserService needed by JwtVerificationService
  providers: [FeatureFlagsService, AppConfigService, JwtVerificationService],
  exports: [FeatureFlagsService, AppConfigService, JwtVerificationService],
})
export class CommonServicesModule {}

