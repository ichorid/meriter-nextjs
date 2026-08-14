import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import {
  connectUzzSeedFactory,
  seedCommunity,
  seedRight,
  seedUser,
  type UzzSeedFactory,
} from '../../../api/apps/meriter/test/uzz-e2e/seed-factory';
import {
  failNextEmailSend,
  readEmailMessages,
  readLastEmail,
  resetFakeEmail,
  waitForLastEmail,
  type FakeEmailMessage,
} from '../../../api/apps/meriter/test/uzz-e2e/fake-email-provider';
import { readTelegramMessages } from '../../../api/apps/meriter/test/uzz-e2e/fake-telegram-provider';

export {
  failNextEmailSend,
  readEmailMessages,
  readLastEmail,
  readTelegramMessages,
  resetFakeEmail,
  seedCommunity,
  seedRight,
  seedUser,
  waitForLastEmail,
};

export const UZZ_SESSION_COOKIE = 'meriter_uzz_session';
export const RUNTIME_COMMUNITY_ID =
  process.env.UZZ_E2E_COMMUNITY_ID ?? 'a1000001-0000-4000-8000-000000000001';
export const API_REPLICA_A = process.env.UZZ_E2E_API_URL ?? 'http://127.0.0.1:8002';
export const API_REPLICA_B = process.env.UZZ_E2E_API_REPLICA_URL ?? 'http://127.0.0.1:8003';

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

type SeedApi = Pick<UzzSeedFactory, 'listing' | 'seedUser' | 'seedCommunity' | 'seedRight'> & {
  runId: string;
  communityId: string;
  countListings(authorId?: string): Promise<number>;
};

export const realUzzTest = base.extend<{ seed: SeedApi }>({
  seed: async ({}, use) => {
    await resetUzzRateLimits();
    await clearIdentityFailureInjection().catch(() => undefined);
    await resetFakeEmail().catch(() => undefined);
    const factory = await connectUzzSeedFactory({ runId: randomUUID() });
    try {
      await use({
        runId: factory.runId,
        communityId: factory.communityId,
        listing: (input) => factory.listing(input),
        seedUser: (input) => factory.seedUser(input),
        seedCommunity: (input) => factory.seedCommunity(input),
        seedRight: (input) => factory.seedRight(input),
        countListings: (authorId) => countListings(factory.communityId, authorId),
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

function mongoClientCtor() {
  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'api', 'package.json'),
    path.join(process.cwd(), '..', 'api', 'package.json'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const req = createRequire(candidate);
      const driver = req('mongodb') as { MongoClient?: unknown; default?: { MongoClient?: unknown } };
      const Client = driver.MongoClient ?? driver.default?.MongoClient;
      if (typeof Client === 'function') {
        return Client as new (url: string) => {
          connect(): Promise<unknown>;
          db(name?: string): {
            collection(name: string): {
              countDocuments(filter: object): Promise<number>;
            };
            command(command: object): Promise<unknown>;
          };
          close(): Promise<void>;
        };
      }
    } catch {
      continue;
    }
  }
  throw new Error('Cannot resolve mongodb.MongoClient');
}

const MongoClient = mongoClientCtor();

function e2eMongoUrl(): string {
  return (
    process.env.UZZ_E2E_MONGO_URL ??
    'mongodb://127.0.0.1:27018/uzz_e2e?directConnection=true'
  );
}

export async function resetUzzRateLimits(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db().collection('uzz_rate_limits').deleteMany({});
  } finally {
    await client.close();
  }
}

export async function countListings(
  communityId = RUNTIME_COMMUNITY_ID,
  authorId?: string,
): Promise<number> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    const filter: Record<string, string> = { communityId };
    if (authorId) filter.authorId = authorId;
    return await client.db().collection('uzz_listings').countDocuments(filter);
  } finally {
    await client.close();
  }
}

export async function injectRetryableIdentityFailureOnce(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db('admin').command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: {
        failCommands: ['find', 'findAndModify'],
        namespace: 'uzz_e2e.user_auth_identities',
        errorCode: 8,
      },
    });
  } finally {
    await client.close();
  }
}

export async function clearIdentityFailureInjection(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db('admin').command({
      configureFailPoint: 'failCommand',
      mode: 'off',
    });
  } finally {
    await client.close();
  }
}

const MAGIC_LINK_RE = /https?:\/\/[^"'<\s]+\/a\/([A-Za-z0-9_-]+)/;

export function magicLinkFromEmail(email: FakeEmailMessage): { url: string; token: string } {
  const source = `${email.html}\n${email.plaintext}`;
  const match = source.match(MAGIC_LINK_RE);
  if (!match?.[0] || !match[1]) {
    throw new Error('magic link missing from fake email');
  }
  return { url: match[0], token: match[1] };
}

export function attachSecretWatch(page: Page): { secrets: string[]; assertNotLeaked(value: string): void } {
  const secrets: string[] = [];
  const record = (value: string) => {
    if (value) secrets.push(value);
  };
  page.on('console', (msg) => record(msg.text()));
  page.on('pageerror', (error) => record(error.message));
  page.on('response', (response) => {
    if (!isUzzTrpcUrl(response.url())) return;
    void response
      .text()
      .then(record)
      .catch(() => undefined);
  });
  return {
    secrets,
    assertNotLeaked(value: string) {
      const haystack = secrets.join('\n');
      expect(haystack).not.toContain(value);
    },
  };
}

export async function requestLoginLink(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
}

export async function sessionCookieNames(context: BrowserContext): Promise<string[]> {
  const cookies = await context.cookies();
  return cookies.filter((cookie) => cookie.name === UZZ_SESSION_COOKIE).map((cookie) => cookie.name);
}

export async function hasUzzSession(context: BrowserContext): Promise<boolean> {
  return (await sessionCookieNames(context)).includes(UZZ_SESSION_COOKIE);
}

export async function postUzzMutation(
  apiBase: string,
  procedure: string,
  input: unknown,
  cookieHeader?: string,
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/trpc/uzz/${procedure}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-meriter-product': 'uzz',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  return { status: response.status, body: await response.text() };
}
