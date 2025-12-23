import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPoll } from './helpers/fixtures';
import { trpcMutation } from './helpers/trpc-test-helper';

describe('Polls E2E (create and cast)', () => {
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

  it('creates a poll and casts votes', async () => {
    const pollDto = createTestPoll('test-community-id', {});
    // Create poll via tRPC
    const poll = await trpcMutation(app, 'polls.create', pollDto);
    expect(poll?.id).toBeDefined();

    const optionId = poll.options[0].id || poll.options[0]._id || poll.options[0].text; // be tolerant
    const castDto = { 
      pollId: poll.id, 
      data: { optionId, walletAmount: 1, quotaAmount: 0 } 
    };
    // Cast vote via tRPC
    const castResult = await trpcMutation(app, 'polls.cast', castDto);
    expect(castResult).toBeDefined();
  });
});


