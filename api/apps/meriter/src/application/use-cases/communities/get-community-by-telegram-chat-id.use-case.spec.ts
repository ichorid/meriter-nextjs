import { GetCommunityByTelegramChatIdUseCase } from './get-community-by-telegram-chat-id.use-case';

describe('GetCommunityByTelegramChatIdUseCase', () => {
  it('returns community when telegramChatId matches current id', async () => {
    const useCase = new GetCommunityByTelegramChatIdUseCase({
      communityModel: {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              id: 'comm1',
              name: 'Test',
              telegramChatId: '-100123',
            },
          ]),
        }),
      } as never,
    });

    const result = await useCase.execute('-100123');
    expect(result).toEqual({
      communityId: 'comm1',
      name: 'Test',
      telegramChatId: '-100123',
      isFrozen: false,
    });
  });

  it('returns community when only legacy chat id matches', async () => {
    const useCase = new GetCommunityByTelegramChatIdUseCase({
      communityModel: {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              id: 'c8695af4240',
              name: 'Ruslan Team',
              telegramChatId: '-1004324573589',
              settings: { telegramLegacyChatIds: ['-5565524009'] },
            },
          ]),
        }),
      } as never,
    });

    const result = await useCase.execute('-5565524009');
    expect(result?.communityId).toBe('c8695af4240');
    expect(result?.telegramChatId).toBe('-1004324573589');
  });

  it('returns null when not found', async () => {
    const useCase = new GetCommunityByTelegramChatIdUseCase({
      communityModel: {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      } as never,
    });

    expect(await useCase.execute('-999')).toBeNull();
  });
});
