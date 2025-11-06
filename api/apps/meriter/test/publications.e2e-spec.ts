import request from 'supertest';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication } from './helpers/fixtures';

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
    // Minimal DTO aligned with controller schema
    const dto = createTestPublication('test-community-id', 'test-user-id', {});

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/publications')
      .send(dto)
      .expect(201);

    expect(createRes.body?.success).toBe(true);
    const created = createRes.body.data;
    expect(created?.id).toBeDefined();

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/publications/${created.id}`)
      .expect(200);

    expect(getRes.body?.success).toBe(true);
    expect(getRes.body.data?.id).toEqual(created.id);
  });
});


