import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test as base } from '@playwright/test';
import {
  connectUzzSeedFactory,
  seedCommunity,
  seedRight,
  seedUser,
  type UzzSeedFactory,
} from '../../../api/apps/meriter/test/uzz-e2e/seed-factory';
import { readLastEmail } from '../../../api/apps/meriter/test/uzz-e2e/fake-email-provider';
import { readTelegramMessages } from '../../../api/apps/meriter/test/uzz-e2e/fake-telegram-provider';

export { readLastEmail, readTelegramMessages, seedCommunity, seedRight, seedUser };

let trpcRequestCount = 0;

export function realTrpcRequestCount(): number {
  return trpcRequestCount;
}

function isUzzTrpcUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.includes('trpc') && pathname.split('/').includes('uzz');
  } catch {
    return false;
  }
}

type SeedApi = Pick<UzzSeedFactory, 'listing' | 'seedUser' | 'seedCommunity' | 'seedRight'>;

export const realUzzTest = base.extend<{ seed: SeedApi }>({
  seed: async ({}, use) => {
    const factory = await connectUzzSeedFactory({ runId: randomUUID() });
    try {
      await use({
        listing: (input) => factory.listing(input),
        seedUser: (input) => factory.seedUser(input),
        seedCommunity: (input) => factory.seedCommunity(input),
        seedRight: (input) => factory.seedRight(input),
      });
    } finally {
      await factory.cleanup();
      await factory.close();
    }
  },
  page: async ({ page }, use) => {
    trpcRequestCount = 0;
    page.on('request', (request) => {
      if (isUzzTrpcUrl(request.url())) {
        trpcRequestCount += 1;
      }
    });
    await use(page);
  },
});

export function assertNoTrpcInterception(
  dir = path.join(process.cwd(), 'e2e', 'real'),
): void {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of files) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      assertNoTrpcInterception(full);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const source = fs.readFileSync(full, 'utf8');
    expect(source, full).not.toMatch(/page\.route\s*\(/);
    expect(source, full).not.toMatch(/\*\*\/trpc\/uzz/);
  }
}
