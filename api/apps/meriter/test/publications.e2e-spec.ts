import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication } from './helpers/fixtures';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Inject a fake authenticated user
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Publications E2E (happy path)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .overrideGuard((MeriterModule as any).prototype?.UserGuard || ({} as any))
      .useClass(AllowAllGuard as any)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (testDb) await testDb.stop();
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


