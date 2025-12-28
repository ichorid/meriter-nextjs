import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MeriterModule } from '../../src/meriter.module';
import { TestDatabaseHelper } from '../test-db.helper';
import { TrpcService } from '../../src/trpc/trpc.service';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import * as cookieParser from 'cookie-parser';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { shouldSuppressError } from './error-suppression.helper';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function mapHttpStatusToSuppressableCode(
  status: number,
): 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | undefined {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return undefined;
  }
}

function getSuppressableCodeFromTrpcError(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  // 1) Prefer the tRPC code if it already matches suppressable codes.
  const directCode = error['code'];
  if (typeof directCode === 'string' && shouldSuppressError(directCode)) {
    return directCode;
  }

  // 2) Fall back to the underlying cause's HTTP-ish status where available.
  const cause = error['cause'];
  if (!isRecord(cause)) {
    return undefined;
  }

  // Nest HttpException instances expose getStatus().
  const getStatus = cause['getStatus'];
  if (typeof getStatus === 'function') {
    const status = (getStatus as (this: unknown) => unknown).call(cause);
    if (typeof status === 'number') {
      return mapHttpStatusToSuppressableCode(status);
    }
  }

  // Some errors expose numeric status/statusCode.
  const status = cause['status'];
  if (typeof status === 'number') {
    return mapHttpStatusToSuppressableCode(status);
  }
  const statusCode = cause['statusCode'];
  if (typeof statusCode === 'number') {
    return mapHttpStatusToSuppressableCode(statusCode);
  }

  // Or nested response.statusCode.
  const response = cause['response'];
  if (isRecord(response)) {
    const responseStatusCode = response['statusCode'];
    if (typeof responseStatusCode === 'number') {
      return mapHttpStatusToSuppressableCode(responseStatusCode);
    }
  }

  return undefined;
}

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
    
    // Delete MONGO_URL if it exists (from global setup) to ensure each test gets its own instance
    // This prevents conflicts where tests try to use the global MongoDB instance
    const _originalMongoUrl = process.env.MONGO_URL;
    delete process.env.MONGO_URL;
    
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
    
    // Add cookie parser middleware (same as main.ts)
    app.use(cookieParser());
    
    // Register tRPC middleware (same as main.ts)
    const trpcService = app.get(TrpcService);
    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
        const suppressableCode = getSuppressableCodeFromTrpcError(error);
        if (isTestEnv && shouldSuppressError(suppressableCode)) {
          return;
        }
        console.error(`tRPC error on '${path}':`, error);
      },
    });
    app.use('/trpc', trpcMiddleware);
    
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
    // Add cookie parser middleware (same as main.ts)
    app.use(cookieParser());
    
    // Register tRPC middleware (same as main.ts)
    const trpcService = app.get(TrpcService);
    const trpcMiddleware = createExpressMiddleware({
      router: trpcService.getRouter(),
      createContext: ({ req, res }) => trpcService.createContext(req, res),
      onError({ error, path }) {
        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
        const suppressableCode = getSuppressableCodeFromTrpcError(error);
        if (isTestEnv && shouldSuppressError(suppressableCode)) {
          return;
        }
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

