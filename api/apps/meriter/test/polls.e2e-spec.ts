import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPoll } from './helpers/fixtures';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Polls E2E (create and cast)', () => {
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

  it('creates a poll and casts votes', async () => {
    const pollDto = createTestPoll('test-community-id', {});
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/polls')
      .send(pollDto)
      .expect(201);
    const poll = createRes.body.data;
    expect(poll?.id).toBeDefined();

    const optionId = poll.options[0].id || poll.options[0]._id || poll.options[0].text; // be tolerant
    const castDto = { optionId, walletAmount: 1, quotaAmount: 0 };
    const castRes = await request(app.getHttpServer())
      .post(`/api/v1/polls/${poll.id}/casts`)
      .send(castDto)
      .expect(201);
    expect(castRes.body.success).toBe(true);
  });
});


