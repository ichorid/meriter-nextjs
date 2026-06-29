import { GetCommunityByTelegramChatIdUseCase } from './get-community-by-telegram-chat-id.use-case';

describe('GetCommunityByTelegramChatIdUseCase', () => {
  it('returns community when telegramChatId matches', async () => {
    const useCase = new GetCommunityByTelegramChatIdUseCase({
      communityModel: {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            id: 'comm1',
            name: 'Test',
            telegramChatId: '-100123',
          }),
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

  it('returns null when not found', async () => {
    const useCase = new GetCommunityByTelegramChatIdUseCase({
      communityModel: {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      } as never,
    });

    expect(await useCase.execute('-999')).toBeNull();
  });
});
