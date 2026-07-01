import type { Community } from '../../domain/models/community/community.schema';
import {
  chatIdsForTelegramApi,
  createTelegramCommunityChatResolver,
  extractCommunityLegacyChatIds,
  pickPreferredCommunityMatch,
} from './telegram-community-chat.resolver';

describe('extractCommunityLegacyChatIds', () => {
  it('returns trimmed string ids from settings', () => {
    expect(
      extractCommunityLegacyChatIds({
        settings: { telegramLegacyChatIds: ['-5565524009', ''] },
      } as Community),
    ).toEqual(['-5565524009']);
  });
});

describe('chatIdsForTelegramApi', () => {
  it('includes current supergroup id and Ruslan postmortem legacy id', () => {
    const ids = chatIdsForTelegramApi(
      {
        telegramChatId: '-1004324573589',
        settings: { telegramLegacyChatIds: ['-5565524009'] },
      } as Community,
    );
    expect(ids).toEqual(
      expect.arrayContaining(['-1004324573589', '-4324573589', '-5565524009']),
    );
  });
});

describe('pickPreferredCommunityMatch', () => {
  it('prefers non-archived active community over archived duplicate', () => {
    const canonical = {
      id: 'c8695af4240',
      name: 'Ruslan Team',
      telegramChatId: '-1004324573589',
      updatedAt: new Date('2026-01-01'),
    } as Community;
    const archived = {
      id: '69a22ed1c90',
      name: 'Ruslan Team (archived duplicate)',
      telegramChatId: '-5565524009',
      updatedAt: new Date('2026-06-01'),
    } as Community;

    expect(pickPreferredCommunityMatch([archived, canonical])).toEqual(canonical);
  });

  it('prefers unfrozen community when both match', () => {
    const active = { id: 'a', name: 'Active', updatedAt: new Date() } as Community;
    const frozen = {
      id: 'b',
      name: 'Frozen',
      telegramFrozenAt: new Date(),
      updatedAt: new Date(),
    } as Community;

    expect(pickPreferredCommunityMatch([frozen, active])).toEqual(active);
  });
});

describe('createTelegramCommunityChatResolver', () => {
  const canonical = {
    id: 'c8695af4240',
    name: 'Ruslan Team',
    telegramChatId: '-1004324573589',
    settings: { telegramLegacyChatIds: ['-5565524009'] },
  } as Community;

  it('finds community by current supergroup chat id', async () => {
    const find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([canonical]) });
    const resolver = createTelegramCommunityChatResolver({
      communityModel: { find } as never,
    });

    const result = await resolver.resolveByIncomingChatId('-1004324573589');
    expect(result?.id).toBe('c8695af4240');
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { telegramChatId: { $in: expect.arrayContaining(['-1004324573589']) } },
          { 'settings.telegramLegacyChatIds': { $in: expect.any(Array) } },
        ]),
      }),
    );
  });

  it('finds community by legacy basic-group chat id', async () => {
    const find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([canonical]) });
    const resolver = createTelegramCommunityChatResolver({
      communityModel: { find } as never,
    });

    const result = await resolver.resolveByIncomingChatId('-5565524009');
    expect(result?.id).toBe('c8695af4240');
  });

  it('resolveCommunityIdForMiniApp excludes frozen communities', async () => {
    const frozen = { ...canonical, telegramFrozenAt: new Date() };
    const find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([frozen]) });
    const resolver = createTelegramCommunityChatResolver({
      communityModel: { find } as never,
    });

    expect(await resolver.resolveCommunityIdForMiniApp('-1004324573589')).toBeNull();
  });

  it('resolveCommunityIdForMiniApp treats telegramFrozenAt null as frozen', async () => {
    const broken = { ...canonical, telegramFrozenAt: null };
    const find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([broken]) });
    const resolver = createTelegramCommunityChatResolver({
      communityModel: { find } as never,
    });

    expect(await resolver.resolveCommunityIdForMiniApp('-1004324573589')).toBeNull();
  });

  it('resolveCommunityIdForMiniApp returns id when telegramFrozenAt is unset', async () => {
    const find = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([canonical]) });
    const resolver = createTelegramCommunityChatResolver({
      communityModel: { find } as never,
    });

    expect(await resolver.resolveCommunityIdForMiniApp('-5565524009')).toBe('c8695af4240');
  });
});
