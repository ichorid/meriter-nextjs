import { expect, test } from '@playwright/test';
import { mockAdminApi, mockGuestApi } from './fixtures/uzz.fixture';

test('email magic link is the only visible sign-in method', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Вход по email' })).toBeVisible();
  await expect(page.getByText('Других способов входа в продукте нет.')).toBeVisible();
  await page.getByLabel('Email').fill('pilot@example.com');
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
  await expect(page.getByText(/Письмо отправлено на pilot@example.com/)).toBeVisible();
  await expect(page.getByText('Тестовый вход')).toHaveCount(0);
});

test('guest catalog is readable and does not leak seller contacts', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/catalog');

  await expect(page.getByRole('heading', { name: 'Найдите, кто может помочь' })).toBeVisible();
  await expect(page.getByText(/Каталог открыт без входа/)).toBeVisible();
  await expect(page.locator('a[href^="https://t.me/"]')).toHaveCount(0);
});

test('admin settings expose every configurable business parameter', async ({ page }) => {
  await mockAdminApi(page);
  await page.goto('/admin');

  for (const name of [
    'Порог заслуг',
    'Переходов права',
    'Таяние, ₽ в день',
    'Нижний номинал, ₽',
    'Рекомендовано карточек',
    'Режим взаимности',
    'Ответ на заявку, часов',
    'Исполнение, дней',
    'Подтверждение, дней',
  ]) {
    await expect(page.getByLabel(name)).toBeVisible();
  }
  await expect(page.getByLabel('Режим взаимности')).toHaveValue('nudge');
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
