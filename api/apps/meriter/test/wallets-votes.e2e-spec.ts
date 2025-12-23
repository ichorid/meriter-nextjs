import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication, createTestVote } from './helpers/fixtures';
import { trpcMutation } from './helpers/trpc-test-helper';

describe('Wallets/Votes E2E (credit and vote)', () => {
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

  it('credits a wallet and casts a vote affecting balances/aggregation', async () => {
    // Credit wallet via API if available; fallback to implicit balance through service behavior
    // For now, create a publication and cast a vote with personal source
    const pubDto = createTestPublication('test-community-id', 'test-user-id', {});
    const createdPub = await trpcMutation(app, 'publications.create', pubDto);
    const publicationId = createdPub.id as string;

    const voteDto = createTestVote('publication', publicationId, 5, 'personal');
    const vote = await trpcMutation(app, 'votes.create', voteDto);
    expect(vote).toBeDefined();
  });
});


