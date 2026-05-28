import { Module } from '@nestjs/common';
import { DomainModule } from '../domain.module';

/**
 * Adapters layer composition root (Phase 2 scaffold).
 * Sub-paths: trpc/, rest/, mappers/, presenters/, enrichment/, resolvers/
 */
@Module({
  imports: [DomainModule],
  providers: [],
  exports: [],
})
export class AdaptersModule {}
