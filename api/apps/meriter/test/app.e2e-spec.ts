import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MeriterModule } from './../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';

describe('MeriterController (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    
    // Set environment variable for DatabaseModule to use
    process.env.MONGO_URL = mongoUri;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    // Clear database between tests
    await testDb.clearDatabase();
  });

  afterAll(async () => {
    // Stop in-memory MongoDB instance
    await testDb.stop();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!!!!');
  });
});
