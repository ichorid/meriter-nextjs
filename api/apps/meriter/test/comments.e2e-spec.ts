import request from 'supertest';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication, createTestComment, createTestVote } from './helpers/fixtures';

describe('Comments E2E (create, list, vote)', () => {
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


