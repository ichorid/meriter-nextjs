import { expect } from '@playwright/test';
import {
  API_REPLICA_A,
  API_REPLICA_B,
  RUNTIME_COMMUNITY_ID,
  ackOutboxWithToken,
  clearIdentityFailureInjection,
  delayTelegramSend,
  expireOutboxLease,
  findDealByParticipants,
  findOutboxById,
  injectWriteFailureOnce,
  loginAs,
  readTelegramMessages,
  realUzzTest,
  resetFakeTelegram,
  runExpiryPage,
  runOutboxBatch,
  snapshotEconomics,
  waitUntil,
} from './fixtures';

realUzzTest.describe.configure({ timeout: 180_000 });

async function linkedUser(
  seed: {
    runId: string;
    seedUser: (input?: {
      displayName?: string;
      telegramUserId?: string;
      telegramUsername?: string;
    }) => Promise<{ id: string; email: string; displayName: string }>;
  },
  displayName: string,
) {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return seed.seedUser({
    displayName,
    telegramUserId: `tg-${slug}-${seed.runId.slice(0, 8)}`,
    telegramUsername: slug,
  });
}

realUzzTest('R13 scan-to-update expiry races skip stale deals and process later deals', async ({
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR13');
  const buyer = await linkedUser(seed, 'BuyerR13');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 3 });
  const ids = [`a-${seed.runId}-1`, `a-${seed.runId}-2`, `a-${seed.runId}-3`];
  for (const [index, id] of ids.entries()) {
    const listing = await seed.listing({
      title: `Срок ${index + 1} ${seed.runId.slice(0, 8)}`,
      authorId: seller.id,
      priceRub: 500,
    });
    const right = await seed.seedRight({ ownerId: buyer.id, nominalRub: 800 });
    await seed.insertDueDeal({
      id,
      buyerId: buyer.id,
      sellerId: seller.id,
      listingId: listing.id,
      rightId: right.id,
      title: listing.title,
      feeSourceCommunityId: RUNTIME_COMMUNITY_ID,
    });
  }

  const afterId = ids[0]!.slice(0, -1);
  const page = await runExpiryPage({
    race: { acceptId: ids[0]!, closeId: ids[1]! },
    afterId,
    limit: 3,
  });
  const stored = await snapshotEconomics([buyer.id, seller.id]);
  const byId = Object.fromEntries(stored.deals.map((deal) => [deal.id, deal.status]));
  const runStatuses = ids.map((id) => byId[id]);
  expect(runStatuses).toEqual(['accepted', 'closed', 'cancelled']);
  expect(page.processed).toBe(1);
  expect(page.skipped).toBe(2);
  expect(page.failed).toBe(0);
  if (page.lastId) {
    expect(ids).toContain(page.lastId);
  }
});

realUzzTest('R14 two outbox workers plus slow Telegram deliver once and reject a stale lease ack', async ({
  seed,
}) => {
  const user = await linkedUser(seed, 'NotifyR14');
  await resetFakeTelegram();
  for (const replica of [API_REPLICA_A, API_REPLICA_B]) {
    const health = await fetch(`${replica.replace(/\/$/, '')}/health`);
    expect(health.ok, replica).toBe(true);
  }
  await delayTelegramSend(8_000);
  const text = `R14 ${seed.runId.slice(0, 8)} one delivery`;
  const { id } = await seed.insertOutbox({
    telegramUserId: `tg-notifyr14-${seed.runId.slice(0, 8)}`,
    text,
  });

  const workerA = runOutboxBatch();
  await waitUntil(async () => {
    const row = await findOutboxById(id);
    return typeof row?.leaseToken === 'string' && row.leaseToken.length > 0;
  }, 45_000);
  const firstClaim = await findOutboxById(id);
  const tokenA = String(firstClaim?.leaseToken);
  expect(tokenA).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await new Promise((resolve) => setTimeout(resolve, 500));

  await expireOutboxLease(id);
  await delayTelegramSend(0);
  const workerB = runOutboxBatch();
  await waitUntil(async () => {
    const row = await findOutboxById(id);
    return typeof row?.leaseToken === 'string' && row.leaseToken !== tokenA;
  }, 45_000);
  const secondClaim = await findOutboxById(id);
  const tokenB = String(secondClaim?.leaseToken);
  expect(tokenB).not.toBe(tokenA);

  expect(await ackOutboxWithToken(id, tokenA)).toBe(0);

  const deliveredB = await workerB;
  expect(deliveredB.delivered).toBe(1);
  expect(deliveredB.failed).toBe(0);
  expect(await ackOutboxWithToken(id, tokenB)).toBe(0);

  const delivered = (await readTelegramMessages()).filter((message) => message.text.includes(text));
  expect(delivered).toHaveLength(1);

  const deliveredA = await workerA;
  expect(deliveredA.delivered).toBe(0);
  expect(user.id).toBeTruthy();
});

realUzzTest('R15 injected transaction failure leaves wallet right deal ledger and outbox unchanged', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR15');
  const buyer = await linkedUser(seed, 'BuyerR15');
  const listing = await seed.listing({
    title: `Откат ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 1000 });

  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 4 });
  const before = await snapshotEconomics([buyer.id, seller.id]);
  await injectWriteFailureOnce('uzz_e2e.uzz_deals');
  try {
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: listing.title })).toBeVisible();
    const requestButton = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: listing.title }) })
      .getByRole('button', { name: 'Оставить заявку' });
    await expect(requestButton).toBeVisible({ timeout: 20_000 });
    await requestButton.click();
    await page.getByLabel('Сообщение исполнителю').fill('Эта заявка должна откатиться');
    await page.getByRole('button', { name: 'Подтвердить заявку' }).click();
    await expect(page.getByRole('dialog')).toContainText(/Сервер не смог|не получилось|попробуйте/i);
  } finally {
    await clearIdentityFailureInjection();
  }

  const after = await snapshotEconomics([buyer.id, seller.id]);
  expect(after.wallets).toEqual(before.wallets);
  expect(after.rights).toEqual(before.rights);
  expect(after.deals).toEqual(before.deals);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.outbox).toEqual(before.outbox);
  expect(after.transactionCount).toBe(before.transactionCount);
  expect(await findDealByParticipants([buyer.id, seller.id])).toBeNull();
});
