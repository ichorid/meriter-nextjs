import { describe, expect, it } from 'vitest';
import { safeAppPath, uzzErrorMessage, walletSourceLabel } from '@/lib/utils';

describe('uzzErrorMessage', () => {
  it.each([
    ['NOMINAL_CHANGED', 'Номинал изменился. Проверьте новую сумму и подтвердите принятие ещё раз'],
    ['MIN_LISTINGS_REQUIRED', 'Сначала добавьте свои предложения'],
    ['IDENTITY_LINK_REQUIRED', 'Сначала привяжите Telegram в профиле'],
    ['WALLET_INSUFFICIENT_FUNDS', 'Недостаточно заслуг: нужна вся сумма либо в кошельке сообщества, либо в общем кошельке'],
    ['DEAL_CANNOT_CANCEL', 'После принятия заказчик не может отменить сделку'],
  ])('maps backend code %s to actionable Russian copy', (code, expected) => {
    expect(uzzErrorMessage({ message: code })).toBe(expected);
  });
});

describe('walletSourceLabel', () => {
  it('distinguishes the community and global wallets without exposing internal ids', () => {
    expect(walletSourceLabel('community-1', 'community-1')).toBe('кошелёк сообщества');
    expect(walletSourceLabel('__global__', 'community-1')).toBe('общий кошелёк');
    expect(walletSourceLabel(undefined, 'community-1')).toBeNull();
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
