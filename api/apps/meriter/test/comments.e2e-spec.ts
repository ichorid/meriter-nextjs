import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication, createTestComment, createTestVote } from './helpers/fixtures';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';

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
    const publication = await trpcMutation(app, 'publications.create', pubDto);
    const publicationId = publication.id as string;

    // Create comment via tRPC
    const commentDto = createTestComment('publication', publicationId, 'Hello world');
    const comment = await trpcMutation(app, 'comments.create', commentDto);
    const commentId = comment.id as string;

    // List comments by publication via tRPC
    const comments = await trpcQuery(app, 'comments.getByPublicationId', { 
      publicationId 
    });
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.some((c: any) => c.id === commentId)).toBe(true);

    // Vote on the comment via tRPC
    const voteDto = createTestVote('comment', commentId, 3, 'personal');
    const voteResult = await trpcMutation(app, 'votes.create', voteDto);
    expect(voteResult).toBeDefined();
  });
});


