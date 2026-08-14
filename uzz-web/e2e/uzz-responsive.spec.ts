import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockGuestApi } from './contract/uzz-contract.fixture';

const UNBROKEN = 'W'.repeat(300);

const longListing = {
  id: 'listing-long',
  authorId: 'seller-1',
  ownerName: 'Анна',
  title: UNBROKEN,
  description: UNBROKEN,
  priceRub: 500,
  deliveryMode: 'offline',
  locationText: UNBROKEN,
  durationText: UNBROKEN,
  availabilityText: 'вечером',
  active: true,
};

async function fulfillUzz(page: Page, responses: Record<string, unknown>): Promise<void> {
  await page.route('**/trpc/uzz/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/trpc/uzz/')[1] ?? '';
    const procedures = path.split(',');
    const payload = procedures.map((procedure) => responses[procedure] ?? { result: { data: { json: null } } });
    await route.fulfill({ json: procedures.length === 1 ? payload[0] : payload });
  });
}

async function mockCatalogWithLongListing(page: Page): Promise<void> {
  const communityId = 'a1000001-0000-4000-8000-000000000001';
  await fulfillUzz(page, {
    'auth.me': { result: { data: { json: { id: 'buyer-1', communityId, communityName: 'Пилот', isUzzAdmin: false } } } },
    'identity.getLinkStatus': { result: { data: { json: { linked: true, email: 'buyer@example.com', telegramUsername: 'buyer', telegramUserId: '1001' } } } },
    'lots.list': { result: { data: { json: [longListing] } } },
    'banks.listMine': { result: { data: { json: [{ id: 'right-1', nominalRub: 1000, status: 'active', hopsLeft: 10 }] } } },
    'lots.canBuy': { result: { data: { json: { allowed: true, nudge: false, missingListingCount: 0 } } } },
    'wallet.getBalance': { result: { data: { json: { localBalance: 0, globalBalance: 2, canPayFee: true } } } },
    'settings.get': { result: { data: { json: { demurrageRubPerDay: 100, nominalFloorRub: 100 } } } },
    'deals.list': { result: { data: { json: [] } } },
  });
}

async function mockDealsWithLongContent(page: Page): Promise<void> {
  const communityId = 'a1000001-0000-4000-8000-000000000001';
  await fulfillUzz(page, {
    'auth.me': { result: { data: { json: { id: 'buyer-1', communityId, communityName: 'Пилот', isUzzAdmin: false } } } },
    'identity.getLinkStatus': { result: { data: { json: { linked: true, email: 'buyer@example.com', telegramUsername: 'buyer', telegramUserId: '1001' } } } },
    'deals.list': {
      result: {
        data: {
          json: [{
            id: 'deal-long',
            status: 'requested',
            myRole: 'buyer',
            counterpartyName: 'Анна',
            communityId,
            listingSnapshot: { title: UNBROKEN, priceRub: 500, deliveryMode: 'offline', locationText: UNBROKEN },
            requestMessage: UNBROKEN,
            currentNominalRub: 600,
            requestedAt: '2026-08-14T10:00:00.000Z',
          }],
        },
      },
    },
    'banks.listMine': { result: { data: { json: [] } } },
    'wallet.getBalance': { result: { data: { json: { localBalance: 1, globalBalance: 0, canPayFee: true } } } },
  });
}

async function assertHorizontallyInViewport(locator: Locator, page: Page): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test('does not clip login, catalog or deals at the project viewport', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход по email' })).toBeVisible();
  await assertNoPageOverflow(page);

  await mockCatalogWithLongListing(page);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Найдите, кто может помочь' })).toBeVisible();
  await assertNoPageOverflow(page);

  await mockDealsWithLongContent(page);
  await page.goto('/deals');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await assertNoPageOverflow(page);
});

test('300-character unbroken listing fields stay in the 320px viewport', async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 320, 'unbroken-content check is for 320px');
  await mockCatalogWithLongListing(page);
  await page.goto('/catalog');

  const title = page.getByRole('heading', { name: UNBROKEN });
  const description = page.locator('p', { hasText: UNBROKEN }).first();
  const badges = page.locator('span', { hasText: UNBROKEN });

  await assertHorizontallyInViewport(title, page);
  await assertHorizontallyInViewport(description, page);
  await expect(badges).toHaveCount(2);
  await assertHorizontallyInViewport(badges.nth(0), page);
  await assertHorizontallyInViewport(badges.nth(1), page);
  await assertNoPageOverflow(page);
});
