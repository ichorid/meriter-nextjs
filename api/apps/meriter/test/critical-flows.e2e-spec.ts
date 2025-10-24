import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { BOT_USERNAME, GLOBAL_FEED_TG_CHAT_ID } from '../src/config';
import Axios from 'axios';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { AssetsService } from '@common/abstracts/assets/assets.service';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { CountersService } from '@common/abstracts/counters/counters.service';
import { HashtagsService } from '../src/hashtags/hashtags.service';
import { PublicationsService } from '../src/publications/publications.service';
import { TransactionsService } from '../src/transactions/transactions.service';
import { WalletsService } from '../src/wallets/wallets.service';

describe('Critical User Flows (E2E)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let server: any;
  let actorsService: ActorsService;
  let assetsService: AssetsService;
  let agreementsService: AgreementsService;
  let countersService: CountersService;
  let hashtagsService: HashtagsService;
  let publicationsService: PublicationsService;
  let transactionsService: TransactionsService;
  let walletsService: WalletsService;
  
  // Track Axios calls to verify bot messages
  let axiosGetSpy: jest.SpyInstance;

  const testData = {
    COMMUNITY_CHAT_ID: '100',
    USER_A_ID: '2',
    USER_B_ID: '3',
    USER_A_JWT: undefined as string,
    USER_B_JWT: undefined as string,
    PUBLICATION_SLUG: undefined as string,
    POLL_SLUG: undefined as string,
  };

  beforeAll(async () => {
    console.log('[SETUP] Starting test database...');
    // Start in-memory MongoDB
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    console.log('[SETUP] MongoDB started');
    
    process.env.MONGO_URL = mongoUri;
    process.env.NODE_ENV = 'test';
    process.env.admin = 'true';
    process.env.JWT_SECRET = 'test-secret-key-for-jwt';

    console.log('[SETUP] Setting up Axios spy...');
    // Spy on Axios to capture telegram messages  
    axiosGetSpy = jest.spyOn(Axios, 'get').mockImplementation((url: string, config?: any) => {
      // Capture all sendMessage calls
      if (url.includes('sendMessage')) {
        return Promise.resolve({ data: { ok: true, result: { message_id: Date.now() } } }) as any;
      }
      if (url.includes('setWebhook')) {
        return Promise.resolve({ data: { ok: true } }) as any;
      }
      if (url.includes('getChat')) {
        return Promise.resolve({
          data: { result: { id: config?.params?.chat_id, type: 'group', title: 'Test Chat' } }
        }) as any;
      }
      if (url.includes('getChatAdministrators')) {
        return Promise.resolve({ data: { result: [{ user: { id: testData.COMMUNITY_CHAT_ID } }] } }) as any;
      }
      if (url.includes('getFile') || url.includes('getChatMember')) {
        return Promise.reject(new Error('Not found')) as any;
      }
      return Promise.reject(new Error('Unmocked axios call: ' + url)) as any;
    });

    console.log('[SETUP] Creating NestJS module...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    console.log('[SETUP] Creating app...');
    app = moduleFixture.createNestApplication();
    
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
    
    console.log('[SETUP] Initializing app...');
    await app.init();
    server = app.getHttpServer();

    console.log('[SETUP] Getting services...');
    actorsService = app.get<ActorsService>(ActorsService);
    assetsService = app.get<AssetsService>(AssetsService);
    agreementsService = app.get<AgreementsService>(AgreementsService);
    countersService = app.get<CountersService>(CountersService);
    hashtagsService = app.get<HashtagsService>(HashtagsService);
    publicationsService = app.get<PublicationsService>(PublicationsService);
    transactionsService = app.get<TransactionsService>(TransactionsService);
    walletsService = app.get<WalletsService>(WalletsService);

    console.log('[SETUP] Creating hashtags...');
    // Initialize global feed and community spaces
    await hashtagsService.model.create({
      domainName: 'hashtag',
      slug: 'merit',
      profile: { name: 'заслуга', description: 'Global feed' },
      meta: { parentTgChatId: GLOBAL_FEED_TG_CHAT_ID },
    });
    await hashtagsService.model.create({
      domainName: 'hashtag',
      slug: 'test',
      profile: { name: 'тест', description: 'Test community' },
      meta: { parentTgChatId: testData.COMMUNITY_CHAT_ID },
    });

    console.log('[SETUP] Creating test users...');
    // Create test users
    const userA = await actorsService.upsert(
      'user',
      { identities: `telegram://${testData.USER_A_ID}` },
      {
        profile: { name: 'User A', username: 'userA' },
        tags: [testData.COMMUNITY_CHAT_ID],
      }
    );
    testData.USER_A_JWT = actorsService.signJWT(
      {
        token: userA.token,
        tgUserId: testData.USER_A_ID,
        tags: [testData.COMMUNITY_CHAT_ID],
      },
      '365d',
    );

    const userB = await actorsService.upsert(
      'user',
      { identities: `telegram://${testData.USER_B_ID}` },
      {
        profile: { name: 'User B', username: 'userB' },
        tags: [testData.COMMUNITY_CHAT_ID],
      }
    );
    testData.USER_B_JWT = actorsService.signJWT(
      {
        token: userB.token,
        tgUserId: testData.USER_B_ID,
        tags: [testData.COMMUNITY_CHAT_ID],
      },
      '365d',
    );

    console.log('[SETUP] Setup complete!');
  }, 60000);

  afterEach(async () => {
    // Clear database between tests - but only if connection exists
    try {
      if (testDb) {
        await testDb.clearDatabase();
      }
    } catch (error) {
      // Ignore errors if connection doesn't exist
      console.log('[CLEANUP] Database clear skipped:', error.message);
    }
  });

  afterAll(async () => {
    axiosGetSpy?.mockRestore();
    
    if (app) {
      await app.close();
    }
    if (testDb) {
      await testDb.stop();
    }
  });

  describe('User Authentication and Basic API Access', () => {
    test('UserGuard validates JWT and grants access to getme endpoint', async () => {
      const response = await request(server)
        .get('/api/rest/getme')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.tgUserId).toBe(testData.USER_A_ID);
      expect(response.body.name).toBe('User A');
    });

    test('UserGuard rejects invalid JWT', async () => {
      const response = await request(server)
        .get('/api/rest/getme')
        .set('Cookie', 'jwt=invalid-jwt-token');

      expect([401, 403]).toContain(response.status);
      // Enhanced: Verify specific error message
      expect(response.body.message || response.body.error).toBeDefined();
      expect(response.body.message || response.body.error).toMatch(/invalid|unauthorized|jwt/i);
    });

    test('UserGuard rejects requests without JWT', async () => {
      const response = await request(server)
        .get('/api/rest/getme');

      expect([401, 403]).toContain(response.status);
      // Enhanced: Verify specific error message
      expect(response.body.message || response.body.error).toBeDefined();
      expect(response.body.message || response.body.error).toMatch(/no.*jwt|token.*provided|unauthorized/i);
    });
  });

  describe('Publication Management', () => {
    test('User can access their publications', async () => {
      const response = await request(server)
        .get('/api/rest/publications/my')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.publications).toBeDefined();
      expect(Array.isArray(response.body.publications)).toBe(true);
      
      // Enhanced: Validate response structure
      expect(response.body).toHaveProperty('publications');
      
      // Enhanced: If publications exist, validate their structure
      if (response.body.publications.length > 0) {
        const publication = response.body.publications[0];
        expect(publication).toHaveProperty('uid');
        expect(publication).toHaveProperty('_id');
        expect(typeof publication.uid).toBe('string');
        expect(publication.uid.length).toBeGreaterThan(0);
      }
    });

    test('User can access community publications', async () => {
      const response = await request(server)
        .get(`/api/rest/publications/communities/${testData.COMMUNITY_CHAT_ID}`)
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.publications).toBeDefined();
      expect(Array.isArray(response.body.publications)).toBe(true);
      
      // Enhanced: Validate response structure
      expect(response.body).toHaveProperty('publications');
      
      // Enhanced: If publications exist, validate their structure
      if (response.body.publications.length > 0) {
        const publication = response.body.publications[0];
        expect(publication).toHaveProperty('uid');
        expect(publication).toHaveProperty('_id');
        expect(typeof publication.uid).toBe('string');
        expect(publication.uid.length).toBeGreaterThan(0);
      }
    });

    test('User cannot access publications from communities they are not members of', async () => {
      // Create a user not in the community
      const outsiderUser = await actorsService.upsert(
        'user',
        { identities: 'telegram://999' },
        {
          profile: { name: 'Outsider', username: 'outsider' },
          tags: ['999'], // Different community
        }
      );
      const outsiderJWT = actorsService.signJWT(
        {
          token: outsiderUser.token,
          tgUserId: '999',
          tags: ['999'],
        },
        '365d',
      );

      // Try to access community publications
      const response = await request(server)
        .get(`/api/rest/publications/communities/${testData.COMMUNITY_CHAT_ID}`)
        .set('Cookie', `jwt=${outsiderJWT}`);

      // Should fail with 403 Forbidden
      expect([403, 401]).toContain(response.status);
      
      // Enhanced: Verify specific error message
      expect(response.body.message || response.body.error).toBeDefined();
      expect(response.body.message || response.body.error).toMatch(/not.*authorized|forbidden|not.*member/i);
    });
  });

  describe('Wallet and Balance Management', () => {
    test('User can check their wallet balance', async () => {
      const response = await request(server)
        .get('/api/rest/wallet')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.wallets).toBeDefined();
      expect(Array.isArray(response.body.wallets)).toBe(true);
      
      // Enhanced: Validate wallet structure if wallets exist
      if (response.body.wallets.length > 0) {
        const wallet = response.body.wallets[0];
        expect(wallet).toHaveProperty('value');
        expect(typeof wallet.value).toBe('number');
        expect(wallet.value).toBeGreaterThanOrEqual(0);
      }
    });

    test('User can check free voting limit', async () => {
      const response = await request(server)
        .get('/api/rest/free?inSpaceSlug=test')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.free).toBeDefined();
      expect(typeof response.body.free).toBe('number');
      expect(response.body.free).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Poll System', () => {
    test('User can create a poll', async () => {
      const pollData = {
        title: 'What is your favorite color?',
        description: 'A simple poll for testing',
        options: [
          { id: 'red', text: 'Red', votes: 0, voterCount: 0 },
          { id: 'blue', text: 'Blue', votes: 0, voterCount: 0 },
          { id: 'green', text: 'Green', votes: 0, voterCount: 0 },
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        communityId: testData.COMMUNITY_CHAT_ID,
      };

      const createResponse = await request(server)
        .post('/api/rest/poll/create')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`)
        .send(pollData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.uid).toBeDefined();
      expect(typeof createResponse.body.uid).toBe('string');
      expect(createResponse.body.uid.length).toBeGreaterThan(0);
      testData.POLL_SLUG = createResponse.body.uid;

      // Verify poll was created in database
      const poll = await publicationsService.model.findOne({
        uid: testData.POLL_SLUG,
        type: 'poll',
      });
      expect(poll).toBeDefined();
      expect(poll.content).toBeDefined();
    });

    test('User can vote on a poll', async () => {
      // First create a poll
      const pollData = {
        title: 'Test Poll',
        options: [
          { id: 'option1', text: 'Option 1', votes: 0, voterCount: 0 },
          { id: 'option2', text: 'Option 2', votes: 0, voterCount: 0 },
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        communityId: testData.COMMUNITY_CHAT_ID,
      };

      const createResponse = await request(server)
        .post('/api/rest/poll/create')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`)
        .send(pollData);

      expect(createResponse.status).toBe(201);
      const pollSlug = createResponse.body.uid;

      // Give User B some wallet balance for voting
      await walletsService.delta(10, {
        telegramUserId: testData.USER_B_ID,
        currencyOfCommunityTgChatId: testData.COMMUNITY_CHAT_ID,
      });

      // User B votes on poll
      const voteResponse = await request(server)
        .post('/api/rest/poll/vote')
        .set('Cookie', `jwt=${testData.USER_B_JWT}`)
        .send({
          pollId: pollSlug,
          optionId: 'option1',
          amount: 5,
        });

      expect(voteResponse.status).toBe(200);

      // Verify poll results updated
      const poll = await publicationsService.model.findOne({
        uid: pollSlug,
        type: 'poll',
      });
      expect(poll).toBeDefined();
      const pollContent = poll.content as any;
      expect(pollContent.options[0].votes).toBe(5); // First option should have 5 votes
      expect(pollContent.totalVotes).toBe(5);

      // Verify wallet deduction
      const walletBalance = await walletsService.getValue({
        telegramUserId: testData.USER_B_ID,
        currencyOfCommunityTgChatId: testData.COMMUNITY_CHAT_ID,
      });
      expect(walletBalance).toBe(5); // 10 - 5 = 5
    });

    test('User can get poll details', async () => {
      // First create a poll
      const pollData = {
        title: 'Test Poll for Details',
        options: [
          { id: 'option1', text: 'Option 1', votes: 0, voterCount: 0 },
          { id: 'option2', text: 'Option 2', votes: 0, voterCount: 0 },
        ],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        communityId: testData.COMMUNITY_CHAT_ID,
      };

      const createResponse = await request(server)
        .post('/api/rest/poll/create')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`)
        .send(pollData);

      expect(createResponse.status).toBe(201);
      const pollSlug = createResponse.body.uid;

      // Get poll details
      const getResponse = await request(server)
        .get(`/api/rest/poll/get?pollId=${pollSlug}`)
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.poll).toBeDefined();
      expect(getResponse.body.poll.uid).toBe(pollSlug);
      expect(getResponse.body.userVotes).toBeDefined();
      expect(getResponse.body.userVoteSummary).toBeDefined();
    });
  });

  describe('Transaction History', () => {
    test('User can view their transaction history', async () => {
      const response = await request(server)
        .get('/api/rest/transactions/my')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions).toBeDefined();
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });

    test('User can view positive transactions only', async () => {
      const response = await request(server)
        .get('/api/rest/transactions/my?positive=true')
        .set('Cookie', `jwt=${testData.USER_A_JWT}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions).toBeDefined();
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });
  });
});
