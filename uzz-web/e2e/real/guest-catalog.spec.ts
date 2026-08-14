import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { realTrpcRequestCount, realUzzTest } from './fixtures';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('guest catalog harness does not reuse an existing :8004 server', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'playwright.real.config.ts'),
    'utf8',
  );
  expect(source).not.toMatch(/reuseExistingServer:\s*true/);
  expect(source).toMatch(/reuseExistingServer:\s*(?:false|!process\.env\.CI)/);
  expect(source).not.toMatch(/(?:^|[\s'"`])-d(?:[\s'"`]|$)/);
  expect(source).toMatch(/&& node -e/);
});

realUzzTest('guest catalog comes from the API', async ({ page, seed }) => {
  const user = await seed.seedUser();
  expect(user.id).toMatch(UUID_RE);
  expect(user.email).not.toContain(':');
  expect(user.email).toMatch(/^user-\d+-[0-9a-f-]+@uzz\.example\.test$/);
  const listing = await seed.listing({
    title: 'Помощь с переездом',
    authorId: user.id,
  });
  expect(listing.id).toMatch(UUID_RE);
  await page.goto('/catalog');
  await expect(page.getByText(listing.title)).toBeVisible();
  expect(realTrpcRequestCount()).toBeGreaterThan(0);
});
