import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcQuery } from './helpers/trpc-test-helper';
import { withSuppressedErrors } from './helpers/error-suppression.helper';
import * as request from 'supertest';
import { uid } from 'uid';

// Set global timeout for tests in this file
jest.setTimeout(60000);

describe('tRPC Connectivity & Auth Flow E2E', () => {
    let app: any;
    let testDb: any;

    beforeAll(async () => {
        // Force MongoMemoryServer by unsetting MONGO_URL
        delete process.env.MONGO_URL;

        // Set required environment variables for config validation
        process.env.JWT_SECRET = 'test-secret';
        process.env.DOMAIN = 'localhost';
        process.env.RP_ORIGIN = 'http://localhost:8080';
        process.env.NODE_ENV = 'test';

        const context = await TestSetupHelper.createTestApp();
        app = context.app;
        testDb = context.testDb;

        // Connect testDb helper to the in-memory database instance
        await testDb.connect(testDb.getUri());
    }, 60000);

    afterAll(async () => {
        await TestSetupHelper.cleanup({ app, testDb });
    });

    afterEach(async () => {
        // Clear global test user
        delete (global as any).testUserId;
    });

    describe('Public Endpoints', () => {
        it('should access public endpoint without authentication', async () => {
            const result = await trpcQuery(app, 'config.getConfig');
            expect(result).toBeDefined();
            expect(result.botUsername).toBeDefined();
            expect(result.features).toBeDefined();
        });
    });

    describe('Protected Endpoints & Auth Flow', () => {
        it('should fail accessing protected endpoint without authentication', async () => {
            await withSuppressedErrors(['UNAUTHORIZED'], async () => {
                const response = await request(app.getHttpServer())
                    .get('/trpc/users.getMe')
                    .expect(401);

                const body = response.body;
                const error = body.error || body.result?.error;
                expect(error).toBeDefined();

                const code = error.data?.code || error.code || (error.json?.data?.code);
                expect(code).toMatch(/UNAUTHORIZED/);
            });
        });

        it('should access protected endpoint with test authentication', async () => {
            const userId = uid(); // Generate a custom ID string

            // 1. Create user in DB directly with the custom 'id' field
            const usersCollection = testDb.getConnection().collection('users');
            await usersCollection.insertOne({
                id: userId, // Must match what UserService expects
                username: 'testuser_trpc',
                displayName: 'Test User TRPC',
                firstName: 'Test',
                lastName: 'User',
                authProvider: 'google',
                authId: 'google_123',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // 2. Set global variable for test authentication
            (global as any).testUserId = userId;

            // 3. Call protected endpoint
            const result = await trpcQuery(app, 'users.getMe');

            expect(result).toBeDefined();
            expect(result.id).toBe(userId);
            expect(result.username).toBe('testuser_trpc');
        });
    });
});
