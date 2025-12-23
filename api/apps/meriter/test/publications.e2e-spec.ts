import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';

describe('Publications E2E (happy path)', () => {
  let app: any;
  let testDb: any;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates a publication and fetches it', async () => {
    // Minimal DTO aligned with tRPC schema
    const dto = createTestPublication('test-community-id', 'test-user-id', {});

    // Create publication via tRPC
    const created = await trpcMutation(app, 'publications.create', dto);
    expect(created?.id).toBeDefined();

    // Fetch publication via tRPC
    const fetched = await trpcQuery(app, 'publications.getById', { id: created.id });
    expect(fetched?.id).toEqual(created.id);
  });
});


