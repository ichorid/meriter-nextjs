import type { Page, Route } from '@playwright/test';

const guestResponses: Record<string, unknown> = {
  'auth.me': { error: { json: { message: 'UNAUTHORIZED', code: -32001 } } },
  'lots.list': { result: { data: { json: [] } } },
  'community.getPublic': { result: { data: { json: { id: 'a1000001-0000-4000-8000-000000000001', name: 'Пилот' } } } },
  'community.getActive': { result: { data: { json: { id: 'a1000001-0000-4000-8000-000000000001', name: 'Пилот' } } } },
};

export async function mockGuestApi(page: Page): Promise<void> {
  await page.route('**/trpc/uzz/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/trpc/uzz/')[1] ?? '';
    if (route.request().method() === 'POST' && path.includes('sendEmailLoginLink')) {
      await route.fulfill({ json: { result: { data: { json: { ok: true } } } } });
      return;
    }
    await fulfillTrpcBatch(route, path, guestResponses);
  });
}

export async function mockAdminApi(page: Page): Promise<void> {
  const communityId = 'a1000001-0000-4000-8000-000000000001';
  const settings = {
    emissionThreshold: 10,
    initialHops: 10,
    demurrageRubPerDay: 100,
    nominalFloorRub: 100,
    defaultNominalRub: 100,
    autoAssignNominal: false,
    minimumListingsToBuy: 3,
    purchaseGateMode: 'nudge',
    requestTtlHours: 48,
    fulfillmentTtlDays: 7,
    confirmationTtlDays: 7,
    notifyRightEmitted: true,
    notifyRequestLifecycle: true,
    notifyDealProgress: true,
    notifyDealClosed: true,
  };
  await page.route('**/trpc/uzz/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/trpc/uzz/')[1] ?? '';
    const responses: Record<string, unknown> = {
      'auth.me': { result: { data: { json: { id: 'admin-1', communityId, communityName: 'Пилот', isUzzAdmin: true } } } },
      'identity.getLinkStatus': { result: { data: { json: { linked: true, email: 'admin@example.com', telegramUsername: 'admin' } } } },
      'deals.list': { result: { data: { json: [] } } },
      'settings.get': { result: { data: { json: settings } } },
      'banks.listAwaitingNominal': { result: { data: { json: [] } } },
      'banks.listHolding': { result: { data: { json: [] } } },
      'deals.adminList': { result: { data: { json: [] } } },
      'ledger.list': { result: { data: { json: { items: [], nextCursor: null } } } },
      'community.listMine': { result: { data: { json: { selectedCommunityId: communityId, communities: [{ id: communityId, name: 'Пилот' }] } } } },
      'community.getActive': { result: { data: { json: { id: communityId, name: 'Пилот' } } } },
    };
    await fulfillTrpcBatch(route, path, responses);
  });
}

export async function mockMemberApi(page: Page, linked: boolean): Promise<void> {
  const communityId = 'a1000001-0000-4000-8000-000000000001';
  const responses: Record<string, unknown> = {
    'auth.me': { result: { data: { json: { id: 'buyer-1', communityId, communityName: 'Пилот', isUzzAdmin: false } } } },
    'identity.getLinkStatus': { result: { data: { json: { linked, email: 'buyer@example.com', telegramUsername: linked ? 'buyer' : null, telegramUserId: linked ? '1001' : null } } } },
    'lots.list': { result: { data: { json: [{ id: 'listing-1', authorId: 'seller-1', ownerName: 'Анна', title: 'Консультация', description: 'Помогу разобраться', priceRub: 500, deliveryMode: 'online', locationText: '', durationText: '1 час', availabilityText: 'вечером', active: true }] } } },
    'banks.listMine': { result: { data: { json: [{ id: 'right-1', nominalRub: 1000, status: 'active', hopsLeft: 10 }] } } },
    'lots.canBuy': { result: { data: { json: { allowed: true, nudge: false, missingListingCount: 0 } } } },
    'wallet.getBalance': { result: { data: { json: { localBalance: 0, globalBalance: 2, canPayFee: true } } } },
    'settings.get': { result: { data: { json: { demurrageRubPerDay: 100, nominalFloorRub: 100 } } } },
    'deals.list': { result: { data: { json: [] } } },
    'community.getPublic': { result: { data: { json: { id: communityId, name: 'Пилот' } } } },
    'community.getActive': { result: { data: { json: { id: communityId, name: 'Пилот' } } } },
  };
  await page.route('**/trpc/uzz/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split('/trpc/uzz/')[1] ?? '';
    await fulfillTrpcBatch(route, path, responses);
  });
}

async function fulfillTrpcBatch(
  route: Route,
  path: string,
  responses: Record<string, unknown>,
): Promise<void> {
  const procedures = path.split(',');
  const payload = procedures.map(
    (procedure) => responses[procedure] ?? { result: { data: { json: null } } },
  );
  await route.fulfill({ json: procedures.length === 1 ? payload[0] : payload });
}
