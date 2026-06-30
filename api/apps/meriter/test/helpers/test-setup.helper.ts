import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MeriterModule } from '../../src/meriter.module';
import { TestDatabaseHelper } from '../test-db.helper';
import { TrpcService } from '../../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface TestAppContext {
  app: INestApplication;
  testDb: TestDatabaseHelper;
}

/**
 * Helper class for setting up test applications
 */
export class TestSetupHelper {
  /**
   * Create a test application with database
   * Note: For tRPC tests, set (global as any).testUserId before making requests
   * @returns Test application context
   */
  static async createTestApp(): Promise<TestAppContext> {
    const testDb = new TestDatabaseHelper();

    const uri = await testDb.start();

    // Ensure DatabaseModule (inside MeriterModule) uses the same in-memory DB
    // (otherwise Nest can end up with multiple mongoose connections and missing models).
    // Also set MONGO_URL_SECONDARY since validation schema requires it
    process.env.MONGO_URL = uri;
    process.env.MONGO_URL_SECONDARY = uri; // Use same URI for secondary in tests
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    })
      .compile();

    const app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    
    await app.init();

    // Wait for the database connection to be ready
    // This ensures the connection is established before tests run
    // Fail fast if connection doesn't establish quickly
    const connection = app.get<Connection>(getConnectionToken());
    if (connection.readyState !== 1) {
      // Connection is not ready (1 = connected), wait for it with short timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Database connection timed out after 5 seconds. Connection state: ${connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`));
        }, 5000); // 5 seconds - fail fast

        if (connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        connection.once('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Database connection failed: ${error.message}`));
        });
      });
    }

    return { app, testDb };
  }
  
  /**
   * Setup tRPC middleware for an existing app instance
   * Use this when you need to customize app setup but still need tRPC
   */
  static setupTrpcMiddleware(app: INestApplication): void {
    app.use(cookieParser());

    const trpcService = app.get(TrpcService);
    const communityTrpcMiddleware = createExpressMiddleware({
      router: trpcService.getCommunityAppRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        console.error(`tRPC community error on '${path}':`, error);
      },
    });
    app.use('/trpc/community', communityTrpcMiddleware);

    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        console.error(`tRPC error on '${path}':`, error);
      },
    });
    app.use('/trpc', trpcMiddleware);
  }

  /**
   * Create test app backed by a single-node MongoDB replica set (required for transactions).
   */
  static async createTestAppWithReplSet(): Promise<{
    app: INestApplication;
    replSet: import('mongodb-memory-server').MongoMemoryReplSet;
  }> {
    const { createMongoMemoryReplSetWithRetry } = await import('../mongo-memory-shared');
    const { unregisterReplSet } = await import('../mongo-memory-registry.js');

    const replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'community_web_dev_test' },
    });
    const mongoUri = replSet.getUri();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();
    await new Promise((r) => setTimeout(r, 300));

    const connection = app.get<Connection>(getConnectionToken());
    if (connection.readyState !== 1) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Database connection timed out. State: ${connection.readyState}`));
        }, 5000);
        if (connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        connection.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }

    return {
      app,
      replSet: Object.assign(replSet, {
        async stopAndUnregister() {
          unregisterReplSet(replSet);
          await replSet.stop();
        },
      }),
    };
  }

  /**
   * Cleanup test application and database
   * @param context Test application context
   */
  static async cleanup(context: TestAppContext): Promise<void> {
    if (context.app) {
      await context.app.close();
    }
    if (context.testDb) {
      await context.testDb.stop();
    }
  }

}

