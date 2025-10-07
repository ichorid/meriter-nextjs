# Testing Guide for Meriter Backend

This guide explains how to write tests for the Meriter backend application without requiring a full MongoDB instance.

## Overview

We use two different approaches depending on the type of test:

1. **Unit Tests**: Use Jest mocks to test business logic in isolation
2. **Integration Tests**: Use `mongodb-memory-server` to test with a real (in-memory) MongoDB instance

## Unit Tests (Recommended for most service tests)

Unit tests use Jest mocks to isolate the service logic from external dependencies like the database.

### Setup Required

```bash
npm install --save-dev @golevelup/ts-jest
```

### Example: Testing a Service with Mocked Dependencies

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Model } from 'mongoose';
import { YourService } from './your.service';
import { YourModel } from './model/your.model';

describe('YourService', () => {
  let service: YourService;
  let mockModel: Model<YourModel>;

  beforeEach(async () => {
    // Create mock model with common Mongoose methods
    mockModel = createMock<Model<YourModel>>({
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        {
          provide: 'YOUR_MODEL_TOKEN', // Use getModelToken('ModelName')
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<YourService>(YourService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find items', async () => {
    const mockData = [{ id: '1', name: 'Test' }];
    jest.spyOn(mockModel, 'find').mockResolvedValue(mockData as any);

    const result = await service.find();

    expect(mockModel.find).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });
});
```

### Real Example

See `apps/meriter/src/hashtags/hashtags.service.spec.ts` for a complete working example.

**Advantages:**
- Fast execution (no database overhead)
- Tests run in isolation
- Easy to test edge cases and error conditions
- Great for testing business logic

**Disadvantages:**
- Doesn't test actual database interactions
- Mocks may not reflect real behavior

## Integration Tests (For testing with real database)

Integration tests use `mongodb-memory-server` to spin up a real MongoDB instance in memory.

### Setup Required

```bash
npm install --save-dev mongodb-memory-server
```

### Test Database Helper

We provide a `TestDatabaseHelper` class (in `apps/meriter/test/test-db.helper.ts`) with the following utilities:

```typescript
const testDb = new TestDatabaseHelper();

// Start in-memory MongoDB
const uri = await testDb.start();

// Connect for direct database operations
await testDb.connect(uri);

// Clear all data between tests
await testDb.clearDatabase();

// Stop the instance
await testDb.stop();
```

### Example: E2E Test with mongodb-memory-server

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TestDatabaseHelper } from './test-db.helper';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;

  beforeAll(async () => {
    // Start in-memory MongoDB
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    
    // Set environment variable for your app to use
    process.env.MONGO_URL = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await testDb.clearDatabase();
  });

  afterAll(async () => {
    await testDb.stop();
  });

  it('should work with database', async () => {
    // Your test here
  });
});
```

### Real Example

See `apps/meriter/test/app.e2e-spec.ts` for a complete working example.

**Advantages:**
- Tests real database interactions
- Catches MongoDB-specific issues
- No need to mock database behavior

**Disadvantages:**
- Slower than unit tests
- Requires more setup
- May need to handle async cleanup

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- hashtags.service.spec.ts

# Run with coverage
npm test:cov

# Run in watch mode
npm test:watch

# Run E2E tests
npm run test:e2e
```

## Best Practices

1. **Use unit tests by default** - They're faster and easier to maintain
2. **Use integration tests sparingly** - Only when you need to test actual database behavior
3. **Clear database between tests** - Use `afterEach` to ensure test isolation
4. **Mock external APIs** - Always mock third-party services (Telegram, S3, etc.)
5. **Test edge cases** - Use mocks to easily simulate error conditions
6. **Keep tests focused** - One logical assertion per test when possible

## Troubleshooting

### MongoDB Memory Server won't start

If you get errors starting mongodb-memory-server, you may need to:

```bash
# Clear the binary cache
rm -rf ~/.cache/mongodb-binaries/

# Or specify a MongoDB version
MONGOMS_VERSION=6.0.0 npm test
```

### Jest doesn't exit after tests

This usually means there are open database connections. Make sure to:
- Call `await testDb.stop()` in `afterAll`
- Close your NestJS app with `await app.close()`
- Add a timeout if needed: `afterAll(async () => { await testDb.stop(); }, 10000);`

### Tests are too slow

- Use unit tests with mocks instead of integration tests
- Run tests in parallel: `npm test -- --maxWorkers=4`
- Reduce the number of integration tests

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [mongodb-memory-server Documentation](https://github.com/nodkz/mongodb-memory-server)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [@golevelup/ts-jest Documentation](https://github.com/golevelup/nestjs/tree/master/packages/testing)

