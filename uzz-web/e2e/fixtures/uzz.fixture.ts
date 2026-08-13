import type { Page, Route } from '@playwright/test';

const guestResponses: Record<string, unknown> = {
  'auth.me': { error: { json: { message: 'UNAUTHORIZED', code: -32001 } } },
  'lots.list': { result: { data: { json: [] } } },
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
    minimumListingsToBuy: 3,
    purchaseGateMode: 'nudge',
    requestTtlHours: 48,
    fulfillmentTtlDays: 7,
    confirmationTtlDays: 7,
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
      'ledger.list': { result: { data: { json: [] } } },
    };
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
