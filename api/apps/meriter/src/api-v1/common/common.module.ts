import { Module } from '@nestjs/common';
import { CookieManager } from './utils/cookie-manager.util';
import { UserEnrichmentService } from './services/user-enrichment.service';
import { CommunityEnrichmentService } from './services/community-enrichment.service';
import { VoteCommentResolverService } from './services/vote-comment-resolver.service';
import { CommentEnrichmentService } from './services/comment-enrichment.service';
import { PermissionsHelperService } from './services/permissions-helper.service';
import { DomainModule } from '../../domain.module';

/**
 * Common module for API v1 shared services and utilities
 */
@Module({
  imports: [DomainModule],
  providers: [
    CookieManager,
    UserEnrichmentService,
    CommunityEnrichmentService,
    VoteCommentResolverService,
    CommentEnrichmentService,
    PermissionsHelperService,
  ],
  exports: [
    CookieManager,
    UserEnrichmentService,
    CommunityEnrichmentService,
    VoteCommentResolverService,
    CommentEnrichmentService,
    PermissionsHelperService,
  ],
})
export class ApiV1CommonModule {}

