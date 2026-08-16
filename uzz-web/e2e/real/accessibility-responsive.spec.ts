import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import {
  RUNTIME_COMMUNITY_ID,
  loginAs,
  realUzzTest,
} from './fixtures';

realUzzTest.describe.configure({ timeout: 180_000 });

const UNBROKEN =
  'ЩелчокЗаЩелчкомНеразрывноеНазваниеУслугиДляПроверкиГоризонтальногоПереноса';
const MULTILINE = [
  'Нужна помощь с переездом в новую квартиру.',
  'Есть хрупкая посуда и два шкафа.',
  'Удобно в субботу вечером после шести.',
].join('\n');

async function expectNoSeriousAxe(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking, `${context}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
}

async function expectTargetTextVisible(page: Page, text: string): Promise<void> {
  const locator = page.getByText(text, { exact: false }).first();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `missing box for ${text}`).toBeTruthy();
  expect(viewport, 'missing viewport').toBeTruthy();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  expect(box!.x).toBeLessThan(viewport!.width);
  expect(box!.x + Math.min(box!.width, viewport!.width)).toBeGreaterThan(0);
}

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

function listingCard(page: Page, title: string): Locator {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
}

function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

realUzzTest('axe finds no serious or critical violations on core UZZ screens', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerAxe');
  const buyer = await linkedUser(seed, 'BuyerAxe');
  const listing = await seed.listing({
    title: `Каталог ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 2000 });
  await seed.setSuperadmin(buyer.id);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход по email' })).toBeVisible();
  await expectNoSeriousAxe(page, 'login');

  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: listing.title })).toBeVisible();
  await expectNoSeriousAxe(page, 'guest catalog');

  await loginAs(page, buyer.email, '/');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 5 });
  await expect(page.getByRole('heading', { name: 'Моё' })).toBeVisible();
  await expectNoSeriousAxe(page, 'authenticated home');

  await page.goto('/catalog');
  const requestButton = listingCard(page, listing.title).getByRole('button', { name: 'Оставить заявку' });
  await expect(requestButton).toBeVisible({ timeout: 20_000 });
  await requestButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Сообщение исполнителю')).toBeVisible();
  await expectNoSeriousAxe(page, 'request dialog');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/deals');
  await expect(page.getByRole('heading', { name: 'Сделки' })).toBeVisible();
  await expectNoSeriousAxe(page, 'deals');

  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Кошелёк' })).toBeVisible();
  await expectNoSeriousAxe(page, 'wallet');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Настройки и контроль' })).toBeVisible();
  await expectNoSeriousAxe(page, 'admin');
});

realUzzTest('keyboard-only journey opens and closes a dialog, traverses tabs, submits a form, reaches mobile admin and restores focus', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerKeys');
  const buyer = await linkedUser(seed, 'BuyerKeys');
  const listing = await seed.listing({
    title: `Клавиатура ${seed.runId.slice(0, 8)}`,
    authorId: seller.id,
    priceRub: 500,
  });
  await seed.seedRight({ ownerId: buyer.id, nominalRub: 2000 });
  await seed.setSuperadmin(buyer.id);

  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 5 });

  const requestButton = listingCard(page, listing.title).getByRole('button', { name: 'Оставить заявку' });
  await expect(requestButton).toBeVisible({ timeout: 20_000 });
  await requestButton.focus();
  await expect(requestButton).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Банк на обмен')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(requestButton).toBeFocused();

  await page.goto('/');
  const rightsTab = page.getByRole('tab', { name: 'Банки' });
  await expect(rightsTab).toBeVisible();
  await rightsTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Мои услуги' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Мои услуги' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Добрые дела' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(rightsTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');

  await page.getByRole('button', { name: 'Добавить услугу' }).press('Enter');
  const createdTitle = `С клавиатуры ${seed.runId.slice(0, 8)}`;
  await page.getByLabel('Название').pressSequentially(createdTitle);
  await page.getByRole('button', { name: 'Опубликовать' }).press('Enter');
  await expect(page.getByRole('heading', { name: createdTitle })).toBeVisible();

  if (isMobileViewport(page)) {
    const adminLink = page
      .getByRole('navigation', { name: 'Мобильные разделы' })
      .getByRole('link', { name: 'Настройки платформы' });
    await expect(adminLink).toBeVisible();
    await adminLink.focus();
    await expect(adminLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: 'Настройки и контроль' })).toBeVisible();
  }
});

realUzzTest('long unbroken and multiline Russian content stays within the viewport', async ({
  page,
  seed,
}) => {
  const seller = await linkedUser(seed, 'SellerWide');
  const buyer = await linkedUser(seed, 'BuyerWide');
  const listing = await seed.listing({
    title: UNBROKEN,
    description: MULTILINE,
    authorId: seller.id,
    priceRub: 500,
  });
  const right = await seed.seedRight({ ownerId: buyer.id, nominalRub: 2000 });
  await seed.insertDueDeal({
    id: randomUUID(),
    buyerId: buyer.id,
    sellerId: seller.id,
    listingId: listing.id,
    rightId: right.id,
    title: UNBROKEN,
    feeSourceCommunityId: RUNTIME_COMMUNITY_ID,
  });

  await loginAs(page, buyer.email, '/catalog');
  await seed.seedWallet({ userId: buyer.id, communityId: RUNTIME_COMMUNITY_ID, balance: 5 });

  await expect(page.getByRole('heading', { name: UNBROKEN })).toBeVisible();
  await expectTargetTextVisible(page, UNBROKEN);
  await expectTargetTextVisible(page, 'Нужна помощь с переездом в новую квартиру.');
  await expectTargetTextVisible(page, 'Удобно в субботу вечером после шести.');
  await expectNoHorizontalOverflow(page);

  await page.goto('/deals');
  await expect(page.getByRole('heading', { name: UNBROKEN })).toBeVisible();
  await expectTargetTextVisible(page, UNBROKEN);
  await expectNoHorizontalOverflow(page);
});
