import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { createTestPublication, createTestComment, createTestVote } from './helpers/fixtures';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Comments E2E (create, list, vote)', () => {
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

  it('creates a comment, lists it, votes on it', async () => {
    // Create a publication to attach the comment to
    const pubDto = createTestPublication('test-community-id', 'test-user-id', {});
    const pubRes = await request(app.getHttpServer())
      .post('/api/v1/publications')
      .send(pubDto)
      .expect(201);
    const publicationId = pubRes.body.data.id as string;

    // Create comment
    const commentDto = createTestComment('publication', publicationId, 'Hello world');
    const createCommentRes = await request(app.getHttpServer())
      .post('/api/v1/comments')
      .send(commentDto)
      .expect(201);
    const commentId = createCommentRes.body.data.id as string;

    // List comments by target
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/comments?targetType=publication&targetId=${publicationId}`)
      .expect(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.some((c: any) => c.id === commentId)).toBe(true);

    // Vote on the comment
    const voteDto = createTestVote('comment', commentId, 3, 'personal');
    const voteRes = await request(app.getHttpServer())
      .post(`/api/v1/comments/${commentId}/votes`)
      .send(voteDto)
      .expect(201);
    expect(voteRes.body.success).toBe(true);
  });
});


