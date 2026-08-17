import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE } from '@/lib/local-datetime';
import {
  UZZ_ERROR_MESSAGES,
  UZZ_UNKNOWN_ERROR_MESSAGE,
  uzzErrorMessage,
} from '@/lib/uzz-error-messages';
import { navigatePendingExternalWindow, safeAppPath, walletSourceLabel } from '@/lib/utils';

function walkTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function extractThrownCodes(root: string): string[] {
  const pattern =
    /(?:Uzz\w+Error|TRPCError)\((?:\{\s*(?:code:\s*'[^']+',\s*)?message:\s*)?'([A-Z][A-Z0-9_]{2,}|[^']+)'/g;
  const codes = new Set<string>();
  for (const file of walkTsFiles(root)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      codes.add(match[1]);
    }
    for (const match of source.matchAll(/Uzz\w+Error\(\s*'([A-Z][A-Z0-9_]{2,})'/g)) {
      codes.add(match[1]);
    }
    for (const match of source.matchAll(/require(?:Text|Id)\([^)]*?,\s*'([A-Z][A-Z0-9_]{2,})'/g)) {
      codes.add(match[1]);
    }
    for (const match of source.matchAll(/optionalText\([^)]*?,\s*\d+,\s*'([A-Z][A-Z0-9_]{2,})'/g)) {
      codes.add(match[1]);
    }
  }
  return [...codes].sort();
}

describe('uzzErrorMessage', () => {
  it.each([
    ['NOMINAL_CHANGED', 'Номинал изменился. Проверьте новую сумму и подтвердите принятие ещё раз'],
    ['MIN_LISTINGS_REQUIRED', 'Сначала добавьте свои предложения'],
    ['IDENTITY_LINK_REQUIRED', 'Сначала привяжите Telegram в профиле'],
    ['DEAL_COUNTERPARTY_IDENTITY_REQUIRED', 'Исполнитель ещё не завершил привязку профиля. Заявку можно отправить, когда связка email и Telegram будет готова'],
    ['COMMUNITY_MEMBERSHIP_REQUIRED', 'Публиковать и меняться услугами можно только участникам выбранного сообщества. Вступите в его Telegram-чат'],
    ['PILOT_COMMUNITY_NOT_TELEGRAM', 'Можно выбрать только Telegram-чат с подключённым ботом'],
    ['WALLET_INSUFFICIENT_FUNDS', 'Недостаточно заслуг: нужна вся сумма либо в кошельке сообщества, либо в общем кошельке'],
    ['DEAL_CANNOT_CANCEL', 'После принятия заказчик не может отменить сделку'],
    ['DEAL_DEADLINE_NOT_FUTURE', DEAL_DEADLINE_NOT_FUTURE_MESSAGE],
    ['LISTING_TITLE_INVALID', 'Название должно содержать от 3 до 120 символов'],
    ['You must be logged in to access this resource', 'Нужно войти по ссылке из письма'],
    ['EMAIL_DELIVERY_UNAVAILABLE', 'Не удалось отправить письмо. Попробуйте ещё раз через минуту'],
    ['TOO_MANY_REQUESTS', 'Слишком много попыток. Подождите немного и попробуйте снова'],
  ])('maps backend code %s to actionable Russian copy', (code, expected) => {
    expect(uzzErrorMessage({ message: code })).toBe(expected);
  });

  it('keeps an unknown SCREAMING_SNAKE code visible instead of a generic fallback', () => {
    expect(uzzErrorMessage({ message: 'BRAND_NEW_UZZ_CODE' })).toContain('BRAND_NEW_UZZ_CODE');
    expect(uzzErrorMessage({ message: 'BRAND_NEW_UZZ_CODE' })).not.toBe(UZZ_UNKNOWN_ERROR_MESSAGE);
  });

  it('maps every UZZ domain error code thrown by the API', () => {
    const apiRoot = path.resolve(__dirname, '../../../../api/apps/meriter/src');
    const codes = extractThrownCodes(path.join(apiRoot, 'application/uzz'))
      .concat(extractThrownCodes(path.join(apiRoot, 'domain/uzz')))
      .concat(extractThrownCodes(path.join(apiRoot, 'infrastructure/uzz')));
    const unique = [...new Set(codes)].filter((code) => /^[A-Z][A-Z0-9_]{2,}$/.test(code));
    const missing = unique.filter((code) => !UZZ_ERROR_MESSAGES[code]);
    expect(missing).toEqual([]);
    expect(unique.length).toBeGreaterThan(40);
  });
});

describe('walletSourceLabel', () => {
  it('distinguishes the community and global wallets without exposing internal ids', () => {
    expect(walletSourceLabel('community-1', 'community-1')).toBe('кошелёк сообщества');
    expect(walletSourceLabel('__global__', 'community-1')).toBe('общий кошелёк');
    expect(walletSourceLabel(undefined, 'community-1')).toBeNull();
  });
});

describe('navigatePendingExternalWindow', () => {
  it('reuses the window opened on the user click', () => {
    const replace = vi.fn();
    const pending = { closed: false, location: { replace } } as unknown as Window;
    expect(navigatePendingExternalWindow(pending, 'https://t.me/meriter_bot')).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://t.me/meriter_bot');
  });
});

describe('safeAppPath', () => {
  it.each([
    ['//evil.test', '/'],
    ['/\\evil.test', '/'],
    ['/%5c%5cevil.test', '/'],
    ['/%255c%255cevil.test', '/'],
    ['https://evil.test', '/'],
    ['javascript:alert(1)', '/'],
    ['/deals?requested=1', '/deals?requested=1'],
  ])('normalizes %s', (input, expected) => expect(safeAppPath(input, '/')).toBe(expected));
});
