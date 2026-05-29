import { Provider } from '@nestjs/common';

/**
 * Application layer use-case provider registry (Phase 2 composition root).
 * Phase 3+ work units append injectable use case classes here for Nest DI.
 */
export const applicationUseCaseProviders: Provider[] = [
  // CreateVoteUseCase wired via factory from routers (see application/use-cases/voting/create-vote.use-case.ts)
];
