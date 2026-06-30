import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MeriterModule } from '../../src/meriter.module';
import { TestDatabaseHelper } from '../test-db.helper';

export async function createTestingApp(): Promise<{ app: INestApplication; testDb: TestDatabaseHelper }>
{
  const testDb = new TestDatabaseHelper();
  const mongoUri = await testDb.start();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      // Override database with in-memory Mongo
      MongooseModule.forRoot(mongoUri),
      MeriterModule,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, testDb };
}


