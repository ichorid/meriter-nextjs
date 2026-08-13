import { UzzRepositories } from '../src/application/uzz/ports/uzz-repositories';
import { appendTelegramNotification } from '../src/application/uzz/use-cases/deal-use-case.helpers';
import { defaultSettings } from '../src/application/uzz/uzz-settings';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ notification settings', () => {
  it('enables every supported Telegram notification by default', () => {
    expect(defaultSettings('community-1', NOW)).toMatchObject({
      notifyRightEmitted: true,
      notifyRequestLifecycle: true,
      notifyDealProgress: true,
      notifyDealClosed: true,
    });
  });

  it('does not enqueue a disabled notification class', async () => {
    const append = jest.fn();
    const repositories = {
      identities: {
        findByCanonicalUserId: jest.fn().mockResolvedValue({
          id: 'identity-1', canonicalUserId: 'seller-1', telegramUserId: '1001',
        }),
        findAliasByUserId: jest.fn(),
        listAliases: jest.fn().mockResolvedValue([]),
      },
      settings: {
        findByCommunityId: jest.fn().mockResolvedValue({
          ...defaultSettings('community-1', NOW),
          notifyRequestLifecycle: false,
        }),
      },
      outbox: { append },
    } as unknown as UzzRepositories;

    await appendTelegramNotification(repositories, {
      operationId: 'operation-1', aggregateId: 'deal-1', communityId: 'community-1',
      targetUserId: 'seller-1', kind: 'deal_requested', text: 'Новая заявка', now: NOW,
    });

    expect(append).not.toHaveBeenCalled();
  });

  it('stores a safe UZZ route with an enabled notification', async () => {
    const append = jest.fn();
    const repositories = {
      identities: {
        findByCanonicalUserId: jest.fn().mockResolvedValue({ id: 'identity-1', canonicalUserId: 'seller-1', telegramUserId: '1001' }),
        findAliasByUserId: jest.fn(), listAliases: jest.fn().mockResolvedValue([]),
      },
      settings: { findByCommunityId: jest.fn().mockResolvedValue(defaultSettings('community-1', NOW)) },
      outbox: { append },
    } as unknown as UzzRepositories;

    await appendTelegramNotification(repositories, {
      operationId: 'operation-2', aggregateId: 'deal-1', communityId: 'community-1',
      targetUserId: 'seller-1', kind: 'deal_accepted', text: 'Заявка принята', now: NOW,
    });

    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ path: '/deals' }),
    }));
  });
});
