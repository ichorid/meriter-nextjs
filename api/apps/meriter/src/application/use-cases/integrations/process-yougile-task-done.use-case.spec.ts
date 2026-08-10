import {
  ProcessYougileTaskDoneUseCase,
  yougileHtmlToPlainText,
  type ProcessYougileTaskDoneDeps,
} from './process-yougile-task-done.use-case';
import type { YougileIntegrationRecord } from '../../../domain/ports/yougile-integration.persistence.port';

const INTEGRATION: YougileIntegrationRecord = {
  id: 'int-1',
  communityId: 'community-1',
  apiKey: 'key',
  webhookSecret: 'secret',
  columnId: 'col-done',
  targetCommunityId: 'community-1',
  enabled: true,
  eventLog: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDeps(overrides?: {
  integration?: Partial<YougileIntegrationRecord> | null;
  claimed?: boolean;
  task?: Record<string, unknown> | null;
  employee?: Record<string, unknown> | null;
  user?: { id: string } | null;
}) {
  const integration =
    overrides?.integration === null
      ? null
      : { ...INTEGRATION, ...overrides?.integration };

  const deps = {
    integrationPersistence: {
      findById: jest.fn().mockResolvedValue(integration),
      findByCommunityId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      markTaskProcessed: jest
        .fn()
        .mockResolvedValue(overrides?.claimed ?? true),
      setProcessedPublicationId: jest.fn().mockResolvedValue(undefined),
      releaseTaskClaim: jest.fn().mockResolvedValue(undefined),
      appendEventLog: jest.fn().mockResolvedValue(undefined),
    },
    yougileApi: {
      verifyApiKey: jest.fn(),
      listProjects: jest.fn(),
      listBoards: jest.fn(),
      listColumns: jest.fn(),
      listColumnTasks: jest.fn().mockResolvedValue([]),
      sendTaskChatMessage: jest.fn().mockResolvedValue(undefined),
      getTask: jest
        .fn()
        .mockResolvedValue(
          overrides?.task !== undefined
            ? overrides.task
            : {
                id: 'task-1',
                title: 'Сделать хорошо',
                columnId: 'col-done',
                assigned: ['emp-1'],
                description: '<p>Описание</p>',
              },
        ),
      getEmployee: jest
        .fn()
        .mockResolvedValue(
          overrides?.employee !== undefined
            ? overrides.employee
            : { id: 'emp-1', email: 'User@Example.com' },
        ),
      createWebhook: jest.fn(),
      disableWebhook: jest.fn(),
    },
    userService: {
      getUserByAuthId: jest
        .fn()
        .mockResolvedValue(
          overrides?.user !== undefined ? overrides.user : { id: 'user-1' },
        ),
    },
    createPublication: {
      execute: jest.fn().mockResolvedValue({
        getId: { getValue: () => 'pub-1' },
      }),
    },
    notificationService: {
      createNotification: jest.fn().mockResolvedValue(undefined),
    },
    appUrl: 'https://app.test',
  };
  return deps as unknown as ProcessYougileTaskDoneDeps & typeof deps;
}

const INPUT = { integrationId: 'int-1', secret: 'secret', taskId: 'task-1' };

describe('ProcessYougileTaskDoneUseCase', () => {
  it('ignores unknown integration', async () => {
    const deps = makeDeps({ integration: null });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('ignored');
    expect(deps.integrationPersistence.markTaskProcessed).not.toHaveBeenCalled();
  });

  it('ignores wrong secret', async () => {
    const deps = makeDeps();
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute({
      ...INPUT,
      secret: 'wrong',
    });
    expect(result.status).toBe('ignored');
  });

  it('ignores disabled integration', async () => {
    const deps = makeDeps({ integration: { enabled: false } });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('ignored');
  });

  it('skips duplicate deliveries without creating a post', async () => {
    const deps = makeDeps({ claimed: false });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('duplicate');
    expect(deps.createPublication.execute).not.toHaveBeenCalled();
    expect(deps.integrationPersistence.releaseTaskClaim).not.toHaveBeenCalled();
  });

  it('releases claim when task is not in the done column', async () => {
    const deps = makeDeps({
      task: { id: 'task-1', title: 'T', columnId: 'col-other' },
    });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('column_mismatch');
    expect(deps.integrationPersistence.releaseTaskClaim).toHaveBeenCalledWith(
      'int-1',
      'task-1',
    );
    expect(deps.createPublication.execute).not.toHaveBeenCalled();
  });

  it('releases claim when task not found in YouGile', async () => {
    const deps = makeDeps({ task: null });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('column_mismatch');
    expect(deps.integrationPersistence.releaseTaskClaim).toHaveBeenCalled();
  });

  it('handles task without assignee', async () => {
    const deps = makeDeps({
      task: { id: 'task-1', title: 'T', columnId: 'col-done', assigned: [] },
    });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('no_assignee');
    expect(deps.integrationPersistence.releaseTaskClaim).toHaveBeenCalled();
  });

  it('handles assignee without a matching Meriter user', async () => {
    const deps = makeDeps({ user: null });
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result.status).toBe('user_not_found');
    expect(deps.integrationPersistence.releaseTaskClaim).toHaveBeenCalled();
    expect(deps.integrationPersistence.appendEventLog).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({ status: 'user_not_found' }),
    );
  });

  it('normalizes assignee email before lookup', async () => {
    const deps = makeDeps();
    await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(deps.userService.getUserByAuthId).toHaveBeenCalledWith(
      'email',
      'user@example.com',
    );
  });

  it('creates a post on behalf of the mapped user without fee or permission checks', async () => {
    const deps = makeDeps();
    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);

    expect(result).toEqual({ status: 'post_created', publicationId: 'pub-1' });
    expect(deps.createPublication.execute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        communityId: 'community-1',
        type: 'text',
        title: 'Выполнена задача: Сделать хорошо',
      }),
      {
        checkPermissions: false,
        processPostCost: false,
        skipTelegramMirror: true,
      },
    );
    expect(
      deps.integrationPersistence.setProcessedPublicationId,
    ).toHaveBeenCalledWith('int-1', 'task-1', 'pub-1');
    expect(deps.integrationPersistence.releaseTaskClaim).not.toHaveBeenCalled();
  });

  it('posts into targetCommunityId when it differs from the source community', async () => {
    const deps = makeDeps({
      integration: { targetCommunityId: 'community-md' },
    });
    await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(deps.createPublication.execute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ communityId: 'community-md' }),
      expect.anything(),
    );
  });

  it('includes a YouGile task link in the post content', async () => {
    const deps = makeDeps();
    await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    const [, dto] = deps.createPublication.execute.mock.calls[0];
    expect(dto.content).toContain(
      'Задача в YouGile: https://ru.yougile.com/team/?task=task-1',
    );
  });

  it('notifies the assignee and replies into the YouGile task chat after posting', async () => {
    const deps = makeDeps();
    await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);

    expect(deps.notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'yougile_task_published',
        metadata: expect.objectContaining({
          communityId: 'community-1',
          publicationId: 'pub-1',
        }),
      }),
    );
    expect(deps.yougileApi.sendTaskChatMessage).toHaveBeenCalledWith(
      'key',
      'task-1',
      expect.objectContaining({
        text: expect.stringContaining(
          'https://app.test/meriter/communities/community-1/posts/pub-1',
        ),
        label: 'Meriter',
      }),
    );
  });

  it('still reports post_created when side effects fail', async () => {
    const deps = makeDeps();
    deps.notificationService.createNotification = jest
      .fn()
      .mockRejectedValue(new Error('notify down'));
    deps.yougileApi.sendTaskChatMessage = jest
      .fn()
      .mockRejectedValue(new Error('yougile down'));

    const result = await new ProcessYougileTaskDoneUseCase(deps).execute(INPUT);
    expect(result).toEqual({ status: 'post_created', publicationId: 'pub-1' });
  });

  it('executeTrusted skips the secret check but keeps enabled/column gating', async () => {
    const deps = makeDeps();
    const useCase = new ProcessYougileTaskDoneUseCase(deps);
    const result = await useCase.executeTrusted({
      integrationId: 'int-1',
      taskId: 'task-1',
    });
    expect(result.status).toBe('post_created');

    const disabledDeps = makeDeps({ integration: { enabled: false } });
    const disabledResult = await new ProcessYougileTaskDoneUseCase(
      disabledDeps,
    ).executeTrusted({ integrationId: 'int-1', taskId: 'task-1' });
    expect(disabledResult.status).toBe('ignored');
  });

  it('releases claim and rethrows when publication creation fails', async () => {
    const deps = makeDeps();
    deps.createPublication.execute = jest
      .fn()
      .mockRejectedValue(new Error('boom'));

    await expect(
      new ProcessYougileTaskDoneUseCase(deps).execute(INPUT),
    ).rejects.toThrow('boom');
    expect(deps.integrationPersistence.releaseTaskClaim).toHaveBeenCalled();
    expect(deps.integrationPersistence.appendEventLog).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({ status: 'error' }),
    );
  });
});

describe('yougileHtmlToPlainText', () => {
  it('strips tags and converts structure to plain text', () => {
    expect(
      yougileHtmlToPlainText(
        '<p>Первый</p><p>Второй&nbsp;абзац</p><ul><li>раз</li><li>два</li></ul>',
      ),
    ).toBe('Первый\nВторой абзац\n- раз\n- два');
  });

  it('decodes basic entities', () => {
    expect(yougileHtmlToPlainText('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe(
      'a & b <c> "d"',
    );
  });
});
