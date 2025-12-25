import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../../src/meriter.module';
import { TestDatabaseHelper } from '../test-db.helper';
import { TrpcService } from '../../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .compile();

    const app = moduleFixture.createNestApplication();
    
    // Add cookie parser middleware (same as main.ts)
    app.use(cookieParser());
    
    // Register tRPC middleware (same as main.ts)
    const trpcService = app.get(TrpcService);
    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        console.error(`tRPC error on '${path}':`, error);
      },
    });
    app.use('/trpc', trpcMiddleware);
    
    await app.init();

    return { app, testDb };
  }
  
  /**
   * Setup tRPC middleware for an existing app instance
   * Use this when you need to customize app setup but still need tRPC
   */
  static setupTrpcMiddleware(app: INestApplication): void {
    // Add cookie parser middleware (same as main.ts)
    app.use(cookieParser());
    
    // Register tRPC middleware (same as main.ts)
    const trpcService = app.get(TrpcService);
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

