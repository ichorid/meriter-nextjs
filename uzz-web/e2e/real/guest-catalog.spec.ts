import { expect } from '@playwright/test';
import { realTrpcRequestCount, realUzzTest } from './fixtures';

realUzzTest('guest catalog comes from the API', async ({ page, seed }) => {
  const listing = await seed.listing({ title: 'Помощь с переездом' });
  await page.goto('/catalog');
  await expect(page.getByText(listing.title)).toBeVisible();
  expect(realTrpcRequestCount()).toBeGreaterThan(0);
});
