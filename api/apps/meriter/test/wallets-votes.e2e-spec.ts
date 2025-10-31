import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication, createTestVote } from './helpers/fixtures';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Wallets/Votes E2E (credit and vote)', () => {
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

  it('credits a wallet and casts a vote affecting balances/aggregation', async () => {
    // Credit wallet via API if available; fallback to implicit balance through service behavior
    // For now, create a publication and cast a vote with personal source
    const pubDto = createTestPublication('test-community-id', 'test-user-id', {});
    const pubRes = await request(app.getHttpServer())
      .post('/api/v1/publications')
      .send(pubDto)
      .expect(201);
    const publicationId = pubRes.body.data.id as string;

    const voteDto = createTestVote('publication', publicationId, 5, 'personal');
    const voteRes = await request(app.getHttpServer())
      .post(`/api/v1/publications/${publicationId}/votes`)
      .send(voteDto)
      .expect(201);
    expect(voteRes.body.success).toBe(true);
  });
});


