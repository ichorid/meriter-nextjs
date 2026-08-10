import {
  ManageYougileIntegrationUseCase,
  type ManageYougileIntegrationDeps,
} from './manage-yougile-integration.use-case';

function createDeps(
  overrides: Partial<ManageYougileIntegrationDeps> = {},
): ManageYougileIntegrationDeps {
  return {
    integrationPersistence: {
      findByCommunityId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'int-1',
        communityId: 'comm-1',
        apiKey: 'issued-key-12345678',
        webhookSecret: 'secret',
        enabled: false,
        eventLog: [],
      }),
      update: jest.fn(),
      delete: jest.fn(),
      listProcessedEvents: jest.fn().mockResolvedValue([]),
    },
    yougileApi: {
      listCompanies: jest.fn().mockResolvedValue([
        { id: 'co-1', name: 'Acme', isAdmin: true },
      ]),
      createApiKey: jest.fn().mockResolvedValue('issued-key-12345678'),
      verifyApiKey: jest.fn().mockResolvedValue(undefined),
      listProjects: jest.fn(),
      listBoards: jest.fn(),
      listColumns: jest.fn(),
      getTask: jest.fn(),
      listColumnTasks: jest.fn(),
      sendTaskChatMessage: jest.fn(),
      getEmployee: jest.fn(),
      createWebhook: jest.fn(),
      disableWebhook: jest.fn(),
    },
    communityService: {
      isUserAdmin: jest.fn().mockResolvedValue(true),
    } as ManageYougileIntegrationDeps['communityService'],
    userService: {
      getDisplayNamesByUserIds: jest.fn(),
    } as ManageYougileIntegrationDeps['userService'],
    publicationPersistence: {
      findByQuery: jest.fn().mockResolvedValue([]),
    } as ManageYougileIntegrationDeps['publicationPersistence'],
    processTaskDone: {
      executeTrusted: jest.fn(),
    },
    appUrl: 'https://app.example.com',
    ...overrides,
  };
}

describe('ManageYougileIntegrationUseCase', () => {
  const actor = { userId: 'user-1', globalRole: null };

  it('discoverCompanies returns companies for valid credentials', async () => {
    const deps = createDeps();
    const useCase = new ManageYougileIntegrationUseCase(deps);

    const companies = await useCase.discoverCompanies(
      'comm-1',
      'Admin@Example.com',
      'secret',
      actor,
    );

    expect(companies).toEqual([{ id: 'co-1', name: 'Acme', isAdmin: true }]);
    expect(deps.yougileApi.listCompanies).toHaveBeenCalledWith({
      login: 'admin@example.com',
      password: 'secret',
    });
  });

  it('connect issues and stores an API key without persisting the password', async () => {
    const deps = createDeps();
    const useCase = new ManageYougileIntegrationUseCase(deps);

    const status = await useCase.connect(
      'comm-1',
      { login: 'admin@example.com', password: 'secret', companyId: 'co-1' },
      actor,
    );

    expect(deps.yougileApi.createApiKey).toHaveBeenCalledWith(
      { login: 'admin@example.com', password: 'secret' },
      'co-1',
    );
    expect(deps.integrationPersistence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'comm-1',
        apiKey: 'issued-key-12345678',
      }),
    );
    expect(status.connected).toBe(true);
    expect(status.apiKeyMask).toBe('••••5678');
  });

  it('connect rejects non-admin companies', async () => {
    const deps = createDeps({
      yougileApi: {
        ...createDeps().yougileApi,
        listCompanies: jest.fn().mockResolvedValue([
          { id: 'co-1', name: 'Acme', isAdmin: false },
        ]),
      },
    });
    const useCase = new ManageYougileIntegrationUseCase(deps);

    await expect(
      useCase.connect(
        'comm-1',
        { login: 'admin@example.com', password: 'secret', companyId: 'co-1' },
        actor,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message:
        'YouGile company admin rights are required to connect the integration',
    });
  });

  it('discoverCompanies maps YouGile 401 to unauthorized', async () => {
    const deps = createDeps({
      yougileApi: {
        ...createDeps().yougileApi,
        listCompanies: jest.fn().mockRejectedValue(
          Object.assign(new Error('auth failed'), { status: 401 }),
        ),
      },
    });
    const useCase = new ManageYougileIntegrationUseCase(deps);

    await expect(
      useCase.discoverCompanies('comm-1', 'bad@example.com', 'wrong', actor),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'YouGile rejected the login or password',
    });
  });
});
