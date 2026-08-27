import { expect, test } from '@playwright/test';
import { mockAdminApi, mockGuestApi, mockMemberApi } from './uzz-contract.fixture';

test('email magic link is the only visible sign-in method', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Вход по email' })).toBeVisible();
  await expect(page.getByText('Введите email — пришлём одноразовую ссылку для входа. Пароль не нужен.')).toBeVisible();
  await page.getByLabel('Email').fill('pilot@example.com');
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
  await expect(page.getByText(/Письмо отправлено на pilot@example.com/)).toBeVisible();
  await expect(page.getByText('Тестовый вход')).toHaveCount(0);
});

test('guest catalog is readable and does not leak seller contacts', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/catalog');

  await expect(page.getByRole('heading', { name: 'Найдите услуги, которые вам нужны' })).toBeVisible();
  await expect(page.getByText(/Вы не авторизованы/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'войдите по одноразовой ссылке' })).toBeVisible();
  await expect(page.locator('a[href^="https://t.me/"]')).toHaveCount(0);
});

test('admin settings expose every configurable business parameter', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('/admin');

  for (const name of [
    'Порог заслуг',
    'Переходов банка',
    'Таяние, ₽ в день',
    'Нижний номинал, ₽',
    'Рекомендовано услуг',
    'Режим взаимности',
    'Ответ на заявку, часов',
    'Исполнение, дней',
    'Подтверждение, дней',
  ]) {
    await expect(page.getByLabel(name)).toBeVisible();
  }
  // Exact match: «Появился банк на обмен» is a substring of the group-announce label.
  for (const name of [
    'Появился банк на обмен',
    'Новая заявка или отмена',
    'Заявка принята или услуга сделана',
    'Сделка закрыта',
    'У участника появился банк на обмен',
    'Состоялась сделка',
  ]) {
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel('Режим взаимности')).toHaveValue('nudge');
});

test('catalog sends an unlinked member to profile without lying about nominal', async ({ page }) => {
  await mockMemberApi(page, false);
  await page.goto('/catalog');

  const action = page.getByRole('button', { name: 'Сначала привяжите Telegram' });
  await expect(action).toBeEnabled();
  await expect(page.getByText('Нужен больший номинал')).toHaveCount(0);
  await action.click();
  // The redirect carries ?from=catalog so the profile can explain why the user landed there.
  await expect(page).toHaveURL(/\/profile\?from=catalog$/);
});

test('deal request flash reports the wallet actually used for the fee', async ({ page }) => {
  await mockMemberApi(page, true);
  await page.goto('/deals?requested=1&feeSource=global');

  await expect(page.getByText('Заявка отправлена. Зарезервирована 1 заслуга с общего кошелька.')).toBeVisible();
});

test('layout has no horizontal overflow at the release viewport', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/login');
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});
