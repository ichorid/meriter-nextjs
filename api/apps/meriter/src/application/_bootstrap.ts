import { Provider } from '@nestjs/common';
import { SeedCommunityWebDevUseCase } from './use-cases/dev/seed-community-web-dev.use-case';

/**
 * Application layer use-case provider registry (Phase 2 composition root).
 * Phase 3+ work units append injectable use case classes here for Nest DI.
 */
export const applicationUseCaseProviders: Provider[] = [
  SeedCommunityWebDevUseCase,
  // CreateVoteUseCase wired via factory from routers (see application/use-cases/voting/create-vote.use-case.ts)
];
