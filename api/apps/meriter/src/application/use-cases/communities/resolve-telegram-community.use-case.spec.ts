import { ResolveTelegramCommunityUseCase } from './resolve-telegram-community.use-case';

describe('ResolveTelegramCommunityUseCase', () => {
  const communityModel = {
    find: jest.fn(),
  };
  const userService = {
    getUserById: jest.fn(),
  };
  const userCommunityRoleService = {
    getRole: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue({ defaultTelegramCommunityId: '' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listForUser returns active TG communities sorted by name', async () => {
    userService.getUserById.mockResolvedValue({
      id: 'u1',
      communityMemberships: ['c1', 'c2', 'c3'],
    });
    communityModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Beta', telegramChatId: '-1001' },
        { id: 'c2', name: 'Alpha', telegramChatId: '-1002' },
        { id: 'c3', name: 'Frozen', telegramChatId: '-1003' },
      ]),
    });
    userCommunityRoleService.getRole.mockImplementation(async (userId: string, communityId: string) =>
      communityId === 'c3' ? null : { userId, communityId, role: 'participant' },
    );

    const useCase = new ResolveTelegramCommunityUseCase({
      userService: userService as never,
      userCommunityRoleService: userCommunityRoleService as never,
      communityModel: communityModel as never,
      configService: configService as never,
    });

    const list = await useCase.listForUser('u1');
    expect(list).toEqual([
      { communityId: 'c2', name: 'Alpha', telegramChatId: '-1002' },
      { communityId: 'c1', name: 'Beta', telegramChatId: '-1001' },
    ]);
  });

  it('execute returns null when user has no TG communities', async () => {
    userService.getUserById.mockResolvedValue({ id: 'u1', communityMemberships: [] });
    const useCase = new ResolveTelegramCommunityUseCase({
      userService: userService as never,
      userCommunityRoleService: userCommunityRoleService as never,
      communityModel: communityModel as never,
      configService: configService as never,
    });
    await expect(useCase.execute('u1')).resolves.toBeNull();
  });
});
