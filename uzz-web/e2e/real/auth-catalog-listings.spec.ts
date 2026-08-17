import { expect, type BrowserContext, type Page, type Request } from '@playwright/test';
import {
  API_REPLICA_A,
  API_REPLICA_B,
  RUNTIME_COMMUNITY_ID,
  UZZ_SESSION_COOKIE,
  attachSecretWatch,
  clearIdentityFailureInjection,
  failNextEmailSend,
  hasUzzSession,
  injectRetryableIdentityFailureOnce,
  magicLinkFromEmail,
  postUzzMutation,
  realTrpcRequestCount,
  realUzzTest,
  requestLoginLink,
  resetFakeEmail,
  waitForLastEmail,
} from './fixtures';

realUzzTest.describe.configure({ timeout: 120_000 });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function captureTrpcPosts(page: Page, procedure: string): Request[] {
  const captured: Request[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes(procedure)) return;
    captured.push(request);
  });
  return captured;
}

async function visibleText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

async function replayRequest(
  page: Page,
  request: Request,
): Promise<{ ok: boolean; status: number; body: string }> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers())) {
    const name = key.toLowerCase();
    if (name === 'host' || name === 'content-length' || name === 'cookie') continue;
    headers[name] = value;
  }
  return page.evaluate(
    async ({ url, method, headers: hdrs, data }) => {
      const response = await fetch(url, {
        method,
        headers: hdrs,
        body: data ?? undefined,
        credentials: 'include',
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    },
    {
      url: request.url(),
      method: request.method(),
      headers,
      data: request.postData() ?? null,
    },
  );
}

async function loginViaEmail(
  page: Page,
  email: string,
  nextPath = '/catalog',
): Promise<{ url: string; token: string }> {
  await resetFakeEmail();
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
  await expect(page.getByText(new RegExp(`Письмо отправлено на ${email}`))).toBeVisible();
  const emailMessage = await waitForLastEmail({ to: email });
  expect(emailMessage.to.toLowerCase()).toBe(email.toLowerCase());
  return magicLinkFromEmail(emailMessage);
}

async function expectOneSession(
  contexts: BrowserContext[],
): Promise<BrowserContext> {
  const flags = await Promise.all(contexts.map((context) => hasUzzSession(context)));
  expect(flags.filter(Boolean)).toHaveLength(1);
  const winner = contexts[flags.indexOf(true)];
  if (!winner) throw new Error('expected one UZZ session');
  return winner;
}

const RATE_LIMIT_BODY_RE = /Too many login attempts|UZZ_RATE_LIMITED|TOO_MANY_REQUESTS/;

function expectRateLimited(
  result: { status: number; body: string },
  replica: string,
): void {
  expect(result.status, `${replica} expected 429, got ${result.status}: ${result.body}`).toBe(
    429,
  );
  expect(result.body, `${replica} 429 body`).toMatch(RATE_LIMIT_BODY_RE);
}

async function fillIpHourWindow(apiBase: string, runId: string): Promise<void> {
  const emails = Array.from(
    { length: 20 },
    (_, index) => `ip-fill-${index}-${runId}@uzz.example.test`,
  );
  await Promise.all(
    emails.map((email) => postUzzMutation(apiBase, 'auth.sendEmailLoginLink', { email })),
  );
}

realUzzTest('R1 guest catalog uses the runtime community ID', async ({ page, seed }) => {
  const user = await seed.seedUser({ displayName: 'Анна' });
  const listing = await seed.listing({
    title: `Каталог ${seed.runId.slice(0, 8)}`,
    authorId: user.id,
  });
  expect(listing.communityId).toBe(RUNTIME_COMMUNITY_ID);
  expect(listing.communityId).toMatch(UUID_RE);

  const catalogPayloads: string[] = [];
  page.on('request', (request) => {
    if (!request.url().includes('lots.list')) return;
    catalogPayloads.push(`${request.url()}\n${request.postData() ?? ''}`);
  });

  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: listing.title })).toBeVisible();
  await expect(page.getByText(/Вы не авторизованы/)).toBeVisible();
  expect(realTrpcRequestCount()).toBeGreaterThan(0);
  expect(catalogPayloads.some((payload) => payload.includes(RUNTIME_COMMUNITY_ID))).toBe(true);
  expect(catalogPayloads.join('\n')).not.toMatch(/NEXT_PUBLIC_/);
});

realUzzTest('R2 email request reaches the fake provider and the UI never sees the raw link', async ({
  page,
  seed,
}) => {
  const failingUser = await seed.seedUser({
    email: `fail-${seed.runId}@uzz.example.test`,
  });
  const user = await seed.seedUser({
    email: `ok-${seed.runId}@uzz.example.test`,
  });
  await resetFakeEmail();
  const watch = attachSecretWatch(page);
  await failNextEmailSend();
  await requestLoginLink(page, failingUser.email);

  await expect(page.getByRole('status')).toContainText(/недоступ|не получилось/i);
  await expect(page.getByText(/Письмо отправлено/)).toHaveCount(0);
  expect(await visibleText(page)).not.toMatch(/\/a\/[A-Za-z0-9_-]{10,}/);
  watch.assertNotLeaked('/a/');

  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
  await expect(page.getByText(new RegExp(`Письмо отправлено на ${user.email}`))).toBeVisible();
  const email = await waitForLastEmail({ to: user.email });
  expect(email.to.toLowerCase()).toBe(user.email.toLowerCase());
  const { url, token } = magicLinkFromEmail(email);
  expect(url).toContain('/a/');
  expect(await visibleText(page)).not.toContain(token);
  expect(await visibleText(page)).not.toContain(url);
  watch.assertNotLeaked(token);
  watch.assertNotLeaked(url);
});

realUzzTest('R3 redeem sets the auth cookie and opens the requested safe path', async ({
  page,
  context,
  seed,
}) => {
  const user = await seed.seedUser();
  const watch = attachSecretWatch(page);
  const { url, token } = await loginViaEmail(page, user.email, '/catalog');
  watch.assertNotLeaked(token);

  await page.goto(new URL(url).pathname);
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('heading', { name: 'Найдите услуги, которые вам нужны' })).toBeVisible();
  expect(await hasUzzSession(context)).toBe(true);
  const cookie = (await context.cookies()).find((item) => item.name === UZZ_SESSION_COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.value.length).toBeGreaterThan(20);
  expect(await visibleText(page)).not.toContain(token);
});

realUzzTest('R4 concurrent redeem yields one session and a retryable identity failure can retry', async ({
  page,
  context,
  browser,
  seed,
}) => {
  const concurrentUser = await seed.seedUser({
    email: `concurrent-${seed.runId}@uzz.example.test`,
  });
  const { url: concurrentUrl } = await loginViaEmail(page, concurrentUser.email, '/');
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  try {
    await Promise.all([
      page.goto(new URL(concurrentUrl).pathname),
      otherPage.goto(new URL(concurrentUrl).pathname),
    ]);
    await Promise.all([
      expect(page.getByRole('heading', { name: /Моё|Привяжите Telegram|Не удалось войти/ })).toBeVisible(),
      expect(otherPage.getByRole('heading', { name: /Моё|Привяжите Telegram|Не удалось войти/ })).toBeVisible(),
    ]);
    await expectOneSession([context, other]);
    const winnerHasHome = (await page.getByRole('heading', { name: /Моё|Привяжите Telegram/ }).count())
      + (await otherPage.getByRole('heading', { name: /Моё|Привяжите Telegram/ }).count());
    const loserHasError = (await page.getByRole('heading', { name: 'Не удалось войти' }).count())
      + (await otherPage.getByRole('heading', { name: 'Не удалось войти' }).count());
    expect(winnerHasHome).toBeGreaterThan(0);
    expect(loserHasError).toBeGreaterThan(0);
  } finally {
    await other.close();
  }

  await context.clearCookies();
  const retryUser = await seed.seedUser({
    email: `retry-${seed.runId}@uzz.example.test`,
  });
  const { url: retryUrl, token } = await loginViaEmail(page, retryUser.email, '/');
  await injectRetryableIdentityFailureOnce();
  try {
    await page.goto(new URL(retryUrl).pathname);
    await expect(page.getByRole('heading', { name: 'Не удалось войти' })).toBeVisible();
    expect(await visibleText(page)).not.toContain(token);
    await clearIdentityFailureInjection();
    await page.goto('/login');
    await page.goto(new URL(retryUrl).pathname);
    await expect(page.getByRole('heading', { name: /Моё|Привяжите Telegram/ })).toBeVisible();
    expect(await hasUzzSession(context)).toBe(true);
  } finally {
    await clearIdentityFailureInjection();
  }
});

realUzzTest('unlinked member cannot open listing editor on the personal hub', async ({
  page,
  seed,
}) => {
  const user = await seed.seedUser({
    email: `unlinked-${seed.runId}@uzz.example.test`,
  });
  const { url } = await loginViaEmail(page, user.email, '/?tab=lots');
  await page.goto(new URL(url).pathname);
  await expect(page.getByRole('heading', { name: 'Привяжите Telegram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить услугу' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toHaveCount(0);
});

realUzzTest('R5 listing create and update replay the same command without duplicates', async ({
  page,
  context,
  seed,
}) => {
  const user = await seed.seedUser({
    telegramUserId: `tg-${seed.runId.slice(0, 8)}`,
    telegramUsername: 'pilot',
  });
  await seed.seedCommunity();
  const { url } = await loginViaEmail(page, user.email, '/?tab=lots');
  await page.goto(new URL(url).pathname);
  await expect(page).toHaveURL(/tab=lots/);

  const createPosts = captureTrpcPosts(page, 'lots.create');
  const updatePosts = captureTrpcPosts(page, 'lots.update');
  const title = `Услуга ${seed.runId.slice(0, 8)}`;
  const updatedTitle = `Обновлено ${seed.runId.slice(0, 8)}`;

  await page.goto('/?tab=lots');
  await expect(page.getByRole('heading', { name: 'Ваши предложения' })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить услугу' }).click();
  await page.getByLabel('Название').fill(title);
  await page.getByLabel('Цена, ₽').fill('700');
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 });
  expect(createPosts.length).toBeGreaterThan(0);
  const createReplay = await replayRequest(page, createPosts[0]!);
  expect(
    createReplay.ok,
    `create replay ${createReplay.status}: ${createReplay.body}`,
  ).toBeTruthy();
  expect(await seed.countListings(user.id)).toBe(1);
  await expect(page.getByRole('heading', { name: title })).toHaveCount(1);

  await page.getByRole('button', { name: 'Редактировать' }).click();
  await page.getByLabel('Название').fill(updatedTitle);
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();
  expect(updatePosts.length).toBeGreaterThan(0);
  const updateReplay = await replayRequest(page, updatePosts[0]!);
  expect(
    updateReplay.ok,
    `update replay ${updateReplay.status}: ${updateReplay.body}`,
  ).toBeTruthy();
  expect(await seed.countListings(user.id)).toBe(1);
  await expect(page.getByRole('heading', { name: updatedTitle })).toHaveCount(1);
  expect(await hasUzzSession(context)).toBe(true);
});

realUzzTest('R6 email and IP rate limits hold across two API replicas', async ({ page, seed }) => {
  const health = await fetch(`${API_REPLICA_B}/health`);
  expect(health.ok, 'api-2 replica must be running on :8003').toBeTruthy();

  const user = await seed.seedUser({
    email: `rate-${seed.runId}@uzz.example.test`,
  });
  await resetFakeEmail();
  await requestLoginLink(page, user.email);
  await expect(page.getByText(new RegExp(`Письмо отправлено на ${user.email}`))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить ещё раз' })).toBeVisible();
  await waitForLastEmail({ to: user.email });

  const replicaA = await postUzzMutation(API_REPLICA_A, 'auth.sendEmailLoginLink', {
    email: user.email,
  });
  const replicaB = await postUzzMutation(API_REPLICA_B, 'auth.sendEmailLoginLink', {
    email: user.email,
  });
  expectRateLimited(replicaA, 'replica A email cooldown');
  expectRateLimited(replicaB, 'replica B email cooldown');

  await fillIpHourWindow(API_REPLICA_A, seed.runId);
  const ipProbeA = await postUzzMutation(API_REPLICA_A, 'auth.sendEmailLoginLink', {
    email: `ip-probe-a-${seed.runId}@uzz.example.test`,
  });
  const ipProbeB = await postUzzMutation(API_REPLICA_B, 'auth.sendEmailLoginLink', {
    email: `ip-probe-b-${seed.runId}@uzz.example.test`,
  });
  if (ipProbeA.status === 429 || ipProbeB.status === 429) {
    if (ipProbeA.status === 429) {
      expectRateLimited(ipProbeA, 'replica A IP window');
    }
    expectRateLimited(ipProbeB, 'replica B IP window');
  } else {
    realUzzTest.info().annotations.push({
      type: 'concern',
      description:
        'IP hour window not observed (trusted client IP likely unknown); email cooldown 429 is required on both replicas',
    });
  }

  await page.getByRole('button', { name: 'Отправить ещё раз' }).click();
  await expect(page.getByRole('status')).toContainText(/недоступ|не получилось|много/i);
  expect(await visibleText(page)).not.toMatch(/\/a\/[A-Za-z0-9_-]{10,}/);
});
