import { UzzForbiddenError, UzzNotFoundError } from '../src/domain/uzz/errors';
import { UzzPlatformCommunity, UzzPlatformPort } from '../src/application/uzz/ports/uzz-platform.port';
import {
  ListPilotCommunitiesUseCase,
  SetPilotCommunityUseCase,
} from '../src/application/uzz/use-cases/pilot-community.use-case';
import { resolveConfiguredCommunityId } from '../src/infrastructure/uzz/persistence/uzz-platform-selection';

const PILOT = {
  id: 'a1000001-0000-4000-8000-000000000001',
  name: 'Пилот',
  telegramChatId: null as string | null,
};
const RUSLAN = {
  id: 'community-ruslan',
  name: 'Заслуги бот Руслан',
  telegramChatId: '2',
};
const DEV_CHAT = {
  id: 'community-dev-chat',
  name: 'Meriter Dev Chat',
  telegramChatId: '-100123',
};

function platformStub(overrides: Partial<UzzPlatformPort> = {}): UzzPlatformPort {
  return {
    configuredCommunityId: async () => PILOT.id,
    setSelectedCommunityId: async () => undefined,
    listTelegramCommunities: async () => [RUSLAN, DEV_CHAT],
    getCommunity: async (id) => [PILOT, RUSLAN, DEV_CHAT].find((entry) => entry.id === id) ?? null,
    getPublication: async () => null,
    listDeedPublications: async () => [],
    listEligibleDeedPublications: async () => [],
    getUserLabels: async () => new Map(),
    ...overrides,
  };
}

describe('UZZ stand community selection', () => {
  it('prefers the stored community over the env default', () => {
    expect(resolveConfiguredCommunityId(RUSLAN.id, PILOT.id)).toBe(RUSLAN.id);
    expect(resolveConfiguredCommunityId('  ', PILOT.id)).toBe(PILOT.id);
    expect(resolveConfiguredCommunityId(null, PILOT.id)).toBe(PILOT.id);
  });

  it('lists Telegram chats with the bot, not Meriter memberships', async () => {
    const useCase = new ListPilotCommunitiesUseCase(
      platformStub(),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute('admin-1')).resolves.toEqual({
      selectedCommunityId: PILOT.id,
      communities: [
        { id: PILOT.id, name: PILOT.name },
        { id: RUSLAN.id, name: RUSLAN.name },
        { id: DEV_CHAT.id, name: DEV_CHAT.name },
      ],
    });
  });

  it('refuses a community that is not a Telegram chat', async () => {
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({ setSelectedCommunityId: setSelected }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute({ adminId: 'admin-1', communityId: PILOT.id }))
      .rejects.toBeInstanceOf(UzzForbiddenError);
    expect(setSelected).not.toHaveBeenCalled();
  });

  it('persists a Telegram chat even when the admin is not a Meriter member', async () => {
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({ setSelectedCommunityId: setSelected }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute({ adminId: 'admin-1', communityId: DEV_CHAT.id }))
      .resolves.toEqual({ communityId: DEV_CHAT.id, communityName: DEV_CHAT.name });
    expect(setSelected).toHaveBeenCalledWith(DEV_CHAT.id);
  });

  it('does not persist an unknown community id', async () => {
    const ghost: UzzPlatformCommunity = {
      id: 'missing', name: 'Призрак', telegramChatId: '-1',
    };
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({
        listTelegramCommunities: async () => [ghost],
        getCommunity: async () => null,
        setSelectedCommunityId: setSelected,
      }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute({ adminId: 'admin-1', communityId: 'missing' }))
      .rejects.toBeInstanceOf(UzzNotFoundError);
    expect(setSelected).not.toHaveBeenCalled();
  });
});
