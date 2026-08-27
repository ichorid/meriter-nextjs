import { expect, type Browser, type Page } from '@playwright/test';
import {
  GLOBAL_COMMUNITY_ID,
  RUNTIME_COMMUNITY_ID,
  captureTrpcResponses,
  findDealByParticipants,
  loginAs,
  parseTrpcJson,
  realUzzTest,
  snapshotEconomics,
} from './fixtures';

realUzzTest.describe.configure({ timeout: 180_000 });

async function linkedUser(
  seed: {
    runId: string;
    seedUser: (input?: {
      email?: string;
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

async function requestDealFromCatalog(page: Page, listingTitle: string, message: string) {
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: listingTitle })).toBeVisible();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: listingTitle }) });
  const requestButton = card.getByRole('button', { name: 'Оставить заявку' });
  await expect(requestButton).toBeVisible({ timeout: 20_000 });
  await requestButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Сообщение исполнителю').fill(message);
  await page.getByRole('button', { name: 'Подтвердить заявку' }).click();
}

async function loginSeller(
  browser: Browser,
  email: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, email, '/deals');
  return { page, close: () => context.close() };
}

async function firstTrpcJson(rows: Array<{ status: number; body: string }>) {
  await expect.poll(() => rows.length).toBeGreaterThan(0);
  expect(rows[0]?.status).toBe(200);
  return parseTrpcJson(rows[0]!.body);
}

function walletOf(
  snapshot: Awaited<ReturnType<typeof snapshotEconomics>>,
  userId: string,
  communityId: string,
): number {
  return snapshot.wallets.find((row) => row.userId === userId && row.communityId === communityId)
    ?.balance ?? 0;
}

realUzzTest('R7 local fee reserve then cancel refunds the wallet and ledger', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR7');
  const buyer = await linkedUser(seed, 'BuyerR7');
  const listing = await seed.listing({
    title: `Переезд ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 1000 });

  const requests = captureTrpcResponses(page, 'deals.request');
  const cancels = captureTrpcResponses(page, 'deals.cancel');
  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 5 });
  await seed.seedWallet({ userId: buyer.id, communityId: GLOBAL_COMMUNITY_ID, balance: 2 });
  await requestDealFromCatalog(page, listing.title, 'Нужна помощь с коробками');
  await expect(page).toHaveURL(/\/deals/);
  await expect(page.getByText(/Зарезервирована 1 заслуга с кошелька сообщества/).first()).toBeVisible();
  const requested = (await firstTrpcJson(requests)) as { status: string; feeSourceCommunityId: string };
  expect(requested.status).toBe('requested');
  expect(requested.feeSourceCommunityId).toBe(RUNTIME_COMMUNITY_ID);

  const reserved = await snapshotEconomics([buyer.id, seller.id]);
  expect(walletOf(reserved, buyer.id, RUNTIME_COMMUNITY_ID)).toBe(4);
  expect(walletOf(reserved, buyer.id, GLOBAL_COMMUNITY_ID)).toBe(2);
  expect(reserved.ledger.some((row) => row.type === 'fee_reserved' && row.amount === -1)).toBe(true);

  await page.getByRole('button', { name: 'Отменить заявку' }).click();
  await page.getByRole('button', { name: 'Подтвердить отмену' }).click();
  await expect(page.getByText('Заявка отменена. Комиссия и банк возвращены.')).toBeVisible();
  await page.locator('label').filter({ hasText: 'Только активные' }).click();
  await expect(page.getByText(/Возвращена 1 заслуга на кошелька сообщества/)).toBeVisible();
  await firstTrpcJson(cancels);

  await page.goto('/wallet');
  await expect(page.getByText('В этом сообществе')).toBeVisible();
  await expect(page.getByText('Комиссия возвращена')).toBeVisible();
  await expect(page.getByText('Источник: кошелёк сообщества').first()).toBeVisible();

  const refunded = await snapshotEconomics([buyer.id, seller.id]);
  expect(walletOf(refunded, buyer.id, RUNTIME_COMMUNITY_ID)).toBe(5);
  expect(refunded.deals[0]?.status).toBe('cancelled');
  expect(refunded.deals[0]?.feeReserved).toBe(false);
  expect(refunded.ledger.some((row) => row.type === 'fee_refunded' && row.amount === 1)).toBe(true);
});

realUzzTest('R8 empty local wallet selects the global wallet and records the ledger', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR8');
  const buyer = await linkedUser(seed, 'BuyerR8');
  const listing = await seed.listing({
    title: `Глобальная комиссия ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 1000 });

  const balances = captureTrpcResponses(page, 'wallet.getBalance');
  const requests = captureTrpcResponses(page, 'deals.request');
  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 0 });
  await seed.seedWallet({ userId: buyer.id, communityId: GLOBAL_COMMUNITY_ID, balance: 3 });
  await page.goto('/wallet');
  await expect(page.getByText('Общий кошелёк')).toBeVisible();
  await expect.poll(() => {
    const last = balances.at(-1);
    return last ? parseTrpcJson(last.body) : null;
  }).toMatchObject({ localBalance: 0, globalBalance: 3 });
  await expect(page.getByText('Резервный источник')).toBeVisible();

  await requestDealFromCatalog(page, listing.title, 'Оплата с общего кошелька');
  await expect(page).toHaveURL(/\/deals/);
  await expect(page.getByText(/Зарезервирована 1 заслуга с общего кошелька/).first()).toBeVisible();
  const requested = (await firstTrpcJson(requests)) as { feeSourceCommunityId: string };
  expect(requested.feeSourceCommunityId).toBe(GLOBAL_COMMUNITY_ID);

  await page.goto('/wallet');
  await expect(page.getByText('Комиссия зарезервирована')).toBeVisible();
  await expect(page.getByText('Источник: общий кошелёк')).toBeVisible();

  const stored = await snapshotEconomics([buyer.id]);
  expect(walletOf(stored, buyer.id, RUNTIME_COMMUNITY_ID)).toBe(0);
  expect(walletOf(stored, buyer.id, GLOBAL_COMMUNITY_ID)).toBe(2);
  expect(stored.ledger).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'fee_reserved', amount: -1, userId: buyer.id }),
    ]),
  );
});

realUzzTest('R9 shared local and global community displays and debits one balance', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR9');
  const buyer = await linkedUser(seed, 'BuyerR9');
  await seed.attachSharedGlobal([buyer.id, seller.id]);
  const listing = await seed.listingIn(GLOBAL_COMMUNITY_ID, {
    title: `Единый кошелёк ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRightIn(GLOBAL_COMMUNITY_ID, { ownerId: buyer.id, nominalRub: 1000 });

  const balances = captureTrpcResponses(page, 'wallet.getBalance');
  const requests = captureTrpcResponses(page, 'deals.request');
  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: GLOBAL_COMMUNITY_ID, balance: 5 });
  await page.goto('/wallet');
  await expect(page.getByText('Единый кошелёк сообщества')).toBeVisible();
  await expect(page.getByText('В этом сообществе')).toHaveCount(0);
  await expect(page.getByText('Общий кошелёк')).toHaveCount(0);
  await expect.poll(() => {
    const last = balances.at(-1);
    return last ? parseTrpcJson(last.body) : null;
  }).toMatchObject({
    mode: 'shared',
    localBalance: 5,
    globalBalance: 0,
    totalBalance: 5,
  });

  await requestDealFromCatalog(page, listing.title, 'Списание с единого кошелька');
  await expect(page).toHaveURL(/\/deals/);
  const requested = (await firstTrpcJson(requests)) as { feeSourceCommunityId: string };
  expect(requested.feeSourceCommunityId).toBe(GLOBAL_COMMUNITY_ID);

  await page.goto('/wallet');
  await expect(page.getByText('Единый кошелёк сообщества')).toBeVisible();
  await expect(page.getByText('4').first()).toBeVisible();

  const stored = await snapshotEconomics([buyer.id]);
  expect(walletOf(stored, buyer.id, GLOBAL_COMMUNITY_ID)).toBe(4);
});

realUzzTest('R10 request accept contacts complete close transfers the right', async ({
  page,
  browser,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR10');
  const buyer = await linkedUser(seed, 'BuyerR10');
  const listing = await seed.listing({
    title: `Консультация ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 700,
  });
  const right = await seed.seedRight({ ownerId: buyer.id, nominalRub: 1200, hopsLeft: 8 });

  const requests = captureTrpcResponses(page, 'deals.request');
  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 2 });
  await requestDealFromCatalog(page, listing.title, 'Нужна консультация вечером');
  await expect(page.getByText('Ждём ответа исполнителя')).toBeVisible();
  await firstTrpcJson(requests);

  const sellerSession = await loginSeller(browser, seller.email);
  try {
    const accepts = captureTrpcResponses(sellerSession.page, 'deals.accept');
    await sellerSession.page.goto('/deals');
    await sellerSession.page.getByRole('button', { name: 'Рассмотреть и принять' }).click();
    await sellerSession.page.getByRole('button', { name: /Принять на 1\s?200 ₽/ }).click();
    await expect(sellerSession.page.getByText('Заявка принята. Контакты открыты обеим сторонам.')).toBeVisible();
    await expect(sellerSession.page.getByRole('link', { name: /Написать @buyerr10/i })).toBeVisible();
    expect(accepts[0]?.status).toBe(200);

    await page.goto('/deals');
    await expect(page.getByRole('link', { name: /Написать @sellerr10/i })).toBeVisible();

    const completes = captureTrpcResponses(sellerSession.page, 'deals.complete');
    await sellerSession.page.getByRole('button', { name: 'Услуга выполнена' }).click();
    await expect(sellerSession.page.getByText('Отмечено как выполненное')).toBeVisible();
    expect(completes[0]?.status).toBe(200);

    const closes = captureTrpcResponses(page, 'deals.close');
    await page.goto('/deals');
    await page.getByRole('button', { name: 'Всё выполнено' }).click();
    await page.getByRole('button', { name: 'Подтвердить закрытие и передачу банка' }).click();
    await expect(page.getByText('Сделка закрыта, банк целиком перешёл исполнителю.')).toBeVisible();
    expect(closes[0]?.status).toBe(200);
  } finally {
    await sellerSession.close();
  }

  const stored = await snapshotEconomics([buyer.id, seller.id]);
  expect(stored.deals[0]?.status).toBe('closed');
  const transferred = stored.rights.find((row) => row.id === right.id);
  expect(transferred?.ownerId).toBe(seller.id);
  expect(stored.ledger).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'right_sent', userId: buyer.id, amount: -1200 }),
      expect.objectContaining({ type: 'right_received', userId: seller.id, amount: 1200 }),
      expect.objectContaining({ type: 'deal_closed' }),
    ]),
  );
});

realUzzTest('R11 current nominal below listing price is disclosed and accepted after reconfirmation', async ({
  page,
  browser,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR11');
  const buyer = await linkedUser(seed, 'BuyerR11');
  const listing = await seed.listing({
    title: `Таяние ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  const right = await seed.seedRight({ ownerId: buyer.id, nominalRub: 800 });

  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 2 });
  await requestDealFromCatalog(page, listing.title, 'Номинал успеет подтаять');
  await expect(page).toHaveURL(/\/deals/);
  await seed.updateRightNominal(right.id, 400);

  const sellerSession = await loginSeller(browser, seller.email);
  try {
    const accepts = captureTrpcResponses(sellerSession.page, 'deals.accept');
    await sellerSession.page.goto('/deals');
    await sellerSession.page.getByRole('button', { name: 'Рассмотреть и принять' }).click();
    await expect(sellerSession.page.getByText('Текущий номинал ниже цены услуги')).toBeVisible();
    await expect(sellerSession.page.getByRole('button', { name: /Принять на 400 ₽/ })).toBeVisible();

    await seed.updateRightNominal(right.id, 350);
    await sellerSession.page.getByRole('button', { name: /Принять на 400 ₽/ }).click();
    await expect(
      sellerSession.page.getByRole('alert').filter({ hasText: /Номинал изменился/ }),
    ).toBeVisible();
    expect(accepts.some((row) => row.status >= 400 || /NOMINAL/i.test(row.body))).toBe(true);

    await expect(sellerSession.page.getByRole('button', { name: /Принять на 350 ₽/ })).toBeVisible({
      timeout: 15_000,
    });
    await sellerSession.page.getByRole('button', { name: /Принять на 350 ₽/ }).click();
    await expect(sellerSession.page.getByText('Заявка принята. Контакты открыты обеим сторонам.')).toBeVisible();
  } finally {
    await sellerSession.close();
  }

  const deal = await findDealByParticipants([buyer.id, seller.id]);
  expect(deal?.status).toBe('accepted');
  expect(deal?.acceptedNominalRub).toBe(350);
});

realUzzTest('R12 optional thanks is sent once and appears in both ledger views', async ({
  page,
  browser,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerR12');
  const buyer = await linkedUser(seed, 'BuyerR12');
  await seed.setSuperadmin(buyer.id);
  const listing = await seed.listing({
    title: `Спасибо ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 900 });

  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 6 });
  await seed.seedWallet({ userId: seller.id, communityId: RUNTIME_COMMUNITY_ID, balance: 0 });
  await requestDealFromCatalog(page, listing.title, 'Закроем и поблагодарим');
  const sellerSession = await loginSeller(browser, seller.email);
  try {
    await sellerSession.page.goto('/deals');
    await sellerSession.page.getByRole('button', { name: 'Рассмотреть и принять' }).click();
    await sellerSession.page.getByRole('button', { name: /Принять на 900 ₽/ }).click();
    await expect(sellerSession.page.getByText('Заявка принята')).toBeVisible();
    await sellerSession.page.getByRole('button', { name: 'Услуга выполнена' }).click();
    await expect(sellerSession.page.getByText('Отмечено как выполненное')).toBeVisible();
  } finally {
    await sellerSession.close();
  }

  await page.goto('/deals');
  await page.getByRole('button', { name: 'Всё выполнено' }).click();
  await page.getByRole('button', { name: 'Подтвердить закрытие и передачу банка' }).click();
  await expect(page.getByText('Сделка закрыта')).toBeVisible();
  // The closed deal stays in the list and the thanks form opens automatically.
  const thanks = captureTrpcResponses(page, 'deals.thank');
  await expect(page.getByPlaceholder('За что хотите поблагодарить')).toBeVisible();
  await page.getByPlaceholder('Заслуг, если хотите добавить').fill('2');
  await page.getByPlaceholder('За что хотите поблагодарить').fill('Очень помогли');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText('Благодарность отправлена.')).toBeVisible();
  expect(thanks[0]?.status).toBe(200);
  await expect(page.getByRole('button', { name: 'Сказать спасибо' })).toHaveCount(0);

  await page.goto('/wallet');
  await expect(page.getByText('Благодарность отправлена')).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Журнал операций' })).toBeVisible();
  await expect(page.getByText('Благодарность отправлена')).toBeVisible();
  await expect(page.getByText('Благодарность получена')).toBeVisible();

  const stored = await snapshotEconomics([buyer.id, seller.id]);
  expect(walletOf(stored, buyer.id, RUNTIME_COMMUNITY_ID)).toBe(3);
  expect(walletOf(stored, seller.id, RUNTIME_COMMUNITY_ID)).toBe(2);
  const thanksRows = stored.ledger.filter((row) => row.type === 'thanks_sent' || row.type === 'thanks_received');
  expect(thanksRows).toHaveLength(2);
});

