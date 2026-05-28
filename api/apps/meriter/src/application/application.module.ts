import { Module } from '@nestjs/common';
import { DomainModule } from '../domain.module';
import { applicationUseCaseProviders } from './_bootstrap';

/**
 * Application layer composition root (Phase 2 scaffold).
 * Sub-path: use-cases/
 */
@Module({
  imports: [DomainModule],
  providers: [...applicationUseCaseProviders],
  exports: [...applicationUseCaseProviders],
})
export class ApplicationModule {}
