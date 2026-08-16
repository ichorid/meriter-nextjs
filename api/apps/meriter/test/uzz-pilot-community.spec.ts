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
  telegramChatId: '1',
};
const RUSLAN = {
  id: 'community-ruslan',
  name: 'Заслуги бот Руслан',
  telegramChatId: '2',
};

function platformStub(overrides: Partial<UzzPlatformPort> = {}): UzzPlatformPort {
  return {
    configuredCommunityId: async () => PILOT.id,
    setSelectedCommunityId: async () => undefined,
    listUserCommunities: async () => [PILOT, RUSLAN],
    getCommunity: async (id) => [PILOT, RUSLAN].find((entry) => entry.id === id) ?? null,
    getPublication: async () => null,
    listDeedPublications: async () => [],
    getDisplayNames: async () => new Map(),
    ...overrides,
  };
}

describe('UZZ stand community selection', () => {
  it('prefers the stored community over the env default', () => {
    expect(resolveConfiguredCommunityId(RUSLAN.id, PILOT.id)).toBe(RUSLAN.id);
    expect(resolveConfiguredCommunityId('  ', PILOT.id)).toBe(PILOT.id);
    expect(resolveConfiguredCommunityId(null, PILOT.id)).toBe(PILOT.id);
  });

  it('lists memberships and keeps the current stand even if the admin left it', async () => {
    const useCase = new ListPilotCommunitiesUseCase(
      platformStub({
        listUserCommunities: async () => [RUSLAN],
      }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute('admin-1')).resolves.toEqual({
      selectedCommunityId: PILOT.id,
      communities: [
        { id: PILOT.id, name: PILOT.name },
        { id: RUSLAN.id, name: RUSLAN.name },
      ],
    });
  });

  it('refuses a community the admin does not belong to', async () => {
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({
        listUserCommunities: async () => [PILOT],
        setSelectedCommunityId: setSelected,
      }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute({ adminId: 'admin-1', communityId: RUSLAN.id }))
      .rejects.toBeInstanceOf(UzzForbiddenError);
    expect(setSelected).not.toHaveBeenCalled();
  });

  it('persists a membership the current stand admin can see', async () => {
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({ setSelectedCommunityId: setSelected }),
      { assertCommunityAdmin: async () => undefined },
    );

    await expect(useCase.execute({ adminId: 'admin-1', communityId: RUSLAN.id }))
      .resolves.toEqual({ communityId: RUSLAN.id, communityName: RUSLAN.name });
    expect(setSelected).toHaveBeenCalledWith(RUSLAN.id);
  });

  it('does not persist an unknown community id', async () => {
    const ghost: UzzPlatformCommunity = {
      id: 'missing', name: 'Призрак', telegramChatId: null,
    };
    const setSelected = jest.fn();
    const useCase = new SetPilotCommunityUseCase(
      platformStub({
        listUserCommunities: async () => [ghost],
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
