import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../../src/meriter.module';
import { TestDatabaseHelper } from '../test-db.helper';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
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
   * @returns Test application context
   */
  static async createTestApp(): Promise<TestAppContext> {
    const testDb = new TestDatabaseHelper();
    const uri = await testDb.start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MeriterModule],
    })
      .overrideGuard((MeriterModule as any).prototype?.UserGuard || ({} as any))
      .useClass(AllowAllGuard as any)
      .compile();

    const app = moduleFixture.createNestApplication();
    await app.init();

    return { app, testDb };
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

  /**
   * Get the AllowAllGuard class for custom test setups
   */
  static getAllowAllGuard(): typeof AllowAllGuard {
    return AllowAllGuard;
  }
}

