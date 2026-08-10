import { ResolveTelegramCommunityUseCase } from './resolve-telegram-community.use-case';

describe('ResolveTelegramCommunityUseCase', () => {
  const communityModel = {
    find: jest.fn(),
  };
  const userCommunityRoleService = {
    getUserRoles: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue({ defaultTelegramCommunityId: '' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listForUser returns active TG communities from roles sorted by name', async () => {
    userCommunityRoleService.getUserRoles.mockResolvedValue([
      { userId: 'u1', communityId: 'c1', role: 'participant' },
      { userId: 'u1', communityId: 'c2', role: 'participant' },
      { userId: 'u1', communityId: 'c3', role: 'participant' },
    ]);
    communityModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Beta', telegramChatId: '-1001' },
        { id: 'c2', name: 'Alpha', telegramChatId: '-1002' },
      ]),
    });

    const useCase = new ResolveTelegramCommunityUseCase({
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

  it('listForUser returns empty when user has no active roles', async () => {
    userCommunityRoleService.getUserRoles.mockResolvedValue([]);
    const useCase = new ResolveTelegramCommunityUseCase({
      userCommunityRoleService: userCommunityRoleService as never,
      communityModel: communityModel as never,
      configService: configService as never,
    });
    await expect(useCase.listForUser('u1')).resolves.toEqual([]);
  });

  it('execute returns null when user has multiple TG communities', async () => {
    userCommunityRoleService.getUserRoles.mockResolvedValue([
      { userId: 'u1', communityId: 'c1', role: 'participant' },
      { userId: 'u1', communityId: 'c2', role: 'participant' },
    ]);
    communityModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Beta', telegramChatId: '-1001' },
        { id: 'c2', name: 'Alpha', telegramChatId: '-1002' },
      ]),
    });

    const useCase = new ResolveTelegramCommunityUseCase({
      userCommunityRoleService: userCommunityRoleService as never,
      communityModel: communityModel as never,
      configService: configService as never,
    });

    await expect(useCase.execute('u1')).resolves.toBeNull();
  });

  it('execute returns the only community when user has one', async () => {
    userCommunityRoleService.getUserRoles.mockResolvedValue([
      { userId: 'u1', communityId: 'c1', role: 'participant' },
    ]);
    communityModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { id: 'c1', name: 'Only', telegramChatId: '-1001' },
      ]),
    });

    const useCase = new ResolveTelegramCommunityUseCase({
      userCommunityRoleService: userCommunityRoleService as never,
      communityModel: communityModel as never,
      configService: configService as never,
    });

    await expect(useCase.execute('u1')).resolves.toEqual({
      communityId: 'c1',
      name: 'Only',
      telegramChatId: '-1001',
    });
  });
});
