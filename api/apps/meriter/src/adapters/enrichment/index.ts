/** Phase 2 — batch enrichment services (p2-enrichment-scaffold). */
export { EnrichmentModule } from './enrichment.module';
export { UserEnrichmentService } from './user-enrichment.service';
export { CommunityEnrichmentService } from './community-enrichment.service';
export {
  CommentEnrichmentService,
  type EnrichedCommentData,
} from './comment-enrichment.service';
