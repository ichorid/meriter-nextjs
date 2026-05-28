import { Module } from '@nestjs/common';
import { DomainModule } from '../../domain.module';
import { UserEnrichmentService } from './user-enrichment.service';
import { CommunityEnrichmentService } from './community-enrichment.service';
import { CommentEnrichmentService } from './comment-enrichment.service';

/**
 * Adapters enrichment layer — batch user/community fetch + comment enrichment.
 */
@Module({
  imports: [DomainModule],
  providers: [
    UserEnrichmentService,
    CommunityEnrichmentService,
    CommentEnrichmentService,
  ],
  exports: [
    UserEnrichmentService,
    CommunityEnrichmentService,
    CommentEnrichmentService,
  ],
})
export class EnrichmentModule {}
