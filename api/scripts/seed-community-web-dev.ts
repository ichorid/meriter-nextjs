#!/usr/bin/env ts-node

/**
 * Idempotent community-web dev seed (explicit re-seed).
 *
 * Usage:
 *   pnpm seed:community-web-dev
 *   pnpm exec ts-node scripts/seed-community-web-dev.ts [--force-content]
 */

import { NestFactory } from '@nestjs/core';
import { MeriterModule } from '../apps/meriter/src/meriter.module';
import { SeedCommunityWebDevUseCase } from '../apps/meriter/src/application/use-cases/dev/seed-community-web-dev.use-case';
import { COMMUNITY_WEB_DEV_COMMUNITY_ID } from '../apps/meriter/src/domain/common/constants/community-web-dev.constants';

async function main(): Promise<void> {
  const forceContent = process.argv.includes('--force-content');

  const app = await NestFactory.createApplicationContext(MeriterModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const useCase = app.get(SeedCommunityWebDevUseCase);
    const result = await useCase.execute({
      ifMissingOnly: !forceContent,
      forceContent,
      explicit: true,
    });

    console.log('\nCommunity-web dev seed complete.');
    console.log(`  communityId: ${result.communityId}`);
    console.log(`  leadUserId: ${result.leadUserId}`);
    console.log(`  participantUserId: ${result.participantUserId}`);
    console.log(`  publicationsCreated: ${result.publicationsCreated}`);
    console.log(`  skippedContent: ${result.skippedContent}`);
    console.log('\nAdd to .env (API + community-web):');
    console.log(`DEFAULT_TELEGRAM_COMMUNITY_ID=${COMMUNITY_WEB_DEV_COMMUNITY_ID}`);
    console.log(`NEXT_PUBLIC_DEFAULT_COMMUNITY_ID=${COMMUNITY_WEB_DEV_COMMUNITY_ID}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
