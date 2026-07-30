import { TestSetupHelper } from './helpers/test-setup.helper';
import { YougileIntegrationPersistenceAdapter } from '../src/infrastructure/persistence/yougile-integration.persistence.adapter';

describe('YougileIntegrationPersistenceAdapter (integration)', () => {
  let app: any;
  let testDb: any;
  let adapter: YougileIntegrationPersistenceAdapter;

  beforeAll(async () => {
    process.env.DOMAIN = process.env.DOMAIN || 'localhost';
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    adapter = app.get(YougileIntegrationPersistenceAdapter);
  }, 30000);

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates and reads an integration by communityId', async () => {
    const created = await adapter.create({
      communityId: 'yg-comm-1',
      apiKey: 'test-key',
      webhookSecret: 'secret-1',
      connectedByUserId: 'user-1',
    });
    expect(created.id).toBeDefined();
    expect(created.enabled).toBe(false);

    const found = await adapter.findByCommunityId('yg-comm-1');
    expect(found?.id).toBe(created.id);
    expect(found?.apiKey).toBe('test-key');
  });

  it('update sets values and unsets null fields', async () => {
    const created = await adapter.create({
      communityId: 'yg-comm-2',
      apiKey: 'k',
      webhookSecret: 's',
    });
    const configured = await adapter.update(created.id, {
      boardId: 'b-1',
      columnId: 'c-1',
      webhookId: 'wh-1',
      enabled: true,
    });
    expect(configured?.enabled).toBe(true);
    expect(configured?.webhookId).toBe('wh-1');

    const reset = await adapter.update(created.id, {
      webhookId: null,
      enabled: false,
    });
    expect(reset?.webhookId).toBeUndefined();
    expect(reset?.enabled).toBe(false);
  });

  it('markTaskProcessed claims a task exactly once per integration', async () => {
    expect(await adapter.markTaskProcessed('int-a', 'task-1')).toBe(true);
    expect(await adapter.markTaskProcessed('int-a', 'task-1')).toBe(false);
    expect(await adapter.markTaskProcessed('int-b', 'task-1')).toBe(true);
    expect(await adapter.markTaskProcessed('int-a', 'task-2')).toBe(true);
  });

  it('releaseTaskClaim removes only unfinalized claims', async () => {
    await adapter.markTaskProcessed('int-c', 'task-done');
    await adapter.setProcessedPublicationId('int-c', 'task-done', 'pub-1');
    await adapter.releaseTaskClaim('int-c', 'task-done');
    // Finalized claim survives the release -> still a duplicate.
    expect(await adapter.markTaskProcessed('int-c', 'task-done')).toBe(false);

    await adapter.markTaskProcessed('int-c', 'task-failed');
    await adapter.releaseTaskClaim('int-c', 'task-failed');
    // Unfinalized claim was released -> can be claimed again.
    expect(await adapter.markTaskProcessed('int-c', 'task-failed')).toBe(true);
  });

  it('listProcessedEvents returns rows for the integration, newest first', async () => {
    await adapter.markTaskProcessed('int-list', 'task-1');
    await adapter.setProcessedPublicationId('int-list', 'task-1', 'pub-list-1');
    await adapter.markTaskProcessed('int-list', 'task-2');
    await adapter.markTaskProcessed('int-other', 'task-3');

    const events = await adapter.listProcessedEvents('int-list');
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.taskId).sort()).toEqual(['task-1', 'task-2']);
    const finalized = events.find((e) => e.taskId === 'task-1');
    expect(finalized?.publicationId).toBe('pub-list-1');
    expect(events.every((e) => e.createdAt instanceof Date)).toBe(true);
  });

  it('appendEventLog prepends entries and caps the log at 20', async () => {
    const created = await adapter.create({
      communityId: 'yg-comm-3',
      apiKey: 'k',
      webhookSecret: 's',
    });
    for (let i = 0; i < 25; i++) {
      await adapter.appendEventLog(created.id, {
        at: new Date(),
        status: 'post_created',
        taskId: `task-${i}`,
      });
    }
    const found = await adapter.findById(created.id);
    expect(found?.eventLog).toHaveLength(20);
    expect(found?.eventLog[0]?.taskId).toBe('task-24');
  });
});
