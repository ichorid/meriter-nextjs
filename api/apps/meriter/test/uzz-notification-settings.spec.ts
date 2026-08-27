import { Connection } from 'mongoose';
import { UzzRepositories } from '../src/application/uzz/ports/uzz-repositories';
import {
  appendGroupTelegramAnnouncement,
  appendTelegramNotification,
} from '../src/application/uzz/use-cases/deal-use-case.helpers';
import { defaultSettings } from '../src/application/uzz/uzz-settings';
import { silenceLegacyGroupAnnouncements } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ notification settings', () => {
  it('enables personal Telegram notifications and keeps the group chat quiet by default', () => {
    expect(defaultSettings('community-1', NOW)).toMatchObject({
      notifyRightEmitted: true,
      notifyRequestLifecycle: true,
      notifyDealProgress: true,
      notifyDealClosed: true,
      groupAnnounceRightEmitted: false,
      groupAnnounceDealClosed: false,
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

  it('enqueues a group announcement to the community chat', async () => {
    const append = jest.fn();
    const repositories = {
      settings: {
        findByCommunityId: jest.fn().mockResolvedValue({
          ...defaultSettings('community-1', NOW),
          groupAnnounceRightEmitted: true,
        }),
      },
      outbox: { append },
    } as unknown as UzzRepositories;

    await appendGroupTelegramAnnouncement(repositories, {
      operationId: 'operation-3', aggregateId: 'right-1', communityId: 'community-1',
      telegramChatId: '-100200300', kind: 'right_emitted', text: 'Появился банк', now: NOW,
    });

    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        telegramChatId: '-100200300',
        path: '/catalog',
        kind: 'group_right_emitted',
      }),
    }));
  });

  it('skips a group announcement when settings are missing (opt-in)', async () => {
    const append = jest.fn();
    const repositories = {
      settings: { findByCommunityId: jest.fn().mockResolvedValue(null) },
      outbox: { append },
    } as unknown as UzzRepositories;

    await appendGroupTelegramAnnouncement(repositories, {
      operationId: 'operation-3b', aggregateId: 'right-1', communityId: 'community-1',
      telegramChatId: '-100200300', kind: 'right_emitted', text: 'Появился банк', now: NOW,
    });

    expect(append).not.toHaveBeenCalled();
  });

  it('skips a group announcement when the class is disabled', async () => {
    const append = jest.fn();
    const repositories = {
      settings: {
        findByCommunityId: jest.fn().mockResolvedValue({
          ...defaultSettings('community-1', NOW),
          groupAnnounceDealClosed: false,
        }),
      },
      outbox: { append },
    } as unknown as UzzRepositories;

    await appendGroupTelegramAnnouncement(repositories, {
      operationId: 'operation-4', aggregateId: 'deal-1', communityId: 'community-1',
      telegramChatId: '-100200300', kind: 'deal_closed', text: 'Сделка состоялась', now: NOW,
    });

    expect(append).not.toHaveBeenCalled();
  });
});

describe('legacy group-chat opt-in migration', () => {
  it('turns stored group announces off once and stamps the opt-in flag', async () => {
    const updateMany = jest.fn();
    const connection = {
      db: { collection: jest.fn().mockReturnValue({ updateMany }) },
    } as unknown as Connection;

    await silenceLegacyGroupAnnouncements(connection);

    expect(updateMany).toHaveBeenCalledWith(
      { groupChatOptInMigrated: { $ne: true } },
      {
        $set: {
          groupAnnounceRightEmitted: false,
          groupAnnounceDealClosed: false,
          groupChatOptInMigrated: true,
        },
      },
    );
  });
});
