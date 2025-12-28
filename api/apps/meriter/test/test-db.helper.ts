import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection, connect } from 'mongoose';

/**
 * Test database helper using mongodb-memory-server
 * Provides an in-memory MongoDB instance for integration tests
 */
export class TestDatabaseHelper {
  private mongod: MongoMemoryServer;
  private connection: Connection;

  /**
   * Start the in-memory MongoDB instance
   * Wraps MongoMemoryServer.create() with a timeout to prevent hanging in CI/CD
   * Always creates a new instance to avoid conflicts with global setup
   */
  async start(): Promise<string> {
    // Always create a new instance, even if MONGO_URL is set (from global setup)
    // This ensures each test gets its own isolated MongoDB instance
    // Wrap MongoMemoryServer.create() with a timeout to fail fast
    const createPromise = MongoMemoryServer.create({
      binary: {
        downloadDir: process.env.MONGOMS_DOWNLOAD_DIR,
      },
      instance: {
        dbName: 'test',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('MongoMemoryServer.create() timed out after 60 seconds. This may indicate network issues or insufficient resources in CI/CD.'));
      }, 60000); // 60 second timeout
    });

    this.mongod = await Promise.race([createPromise, timeoutPromise]);
    const uri = this.mongod.getUri();
    return uri;
  }

  /**
   * Connect to the in-memory MongoDB instance
   */
  async connect(uri?: string): Promise<Connection> {
    const mongoUri = uri || (await this.start());
    // Add connection timeout options to prevent hanging
    this.connection = (await connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // 5 seconds
      connectTimeoutMS: 5000, // 5 seconds
      socketTimeoutMS: 5000, // 5 seconds
    })).connection;
    return this.connection;
  }

  /**
   * Get MongooseModule for NestJS testing
   */
  static getMongooseTestModule(uri: string, options?: MongooseModuleOptions) {
    return MongooseModule.forRoot(uri, {
      ...options,
    });
  }

  /**
   * Clear all collections in the database
   */
  async clearDatabase(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const collections = this.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }

  /**
   * Drop all collections in the database
   */
  async dropDatabase(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    await this.connection.dropDatabase();
  }

  /**
   * Close the database connection
   */
  async closeConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * Stop the in-memory MongoDB instance
   */
  async stop(): Promise<void> {
    await this.closeConnection();
    if (this.mongod) {
      await this.mongod.stop();
    }
  }

  /**
   * Get the URI of the in-memory MongoDB instance
   */
  getUri(): string {
    if (!this.mongod) {
      throw new Error('MongoDB instance not started');
    }
    return this.mongod.getUri();
  }

  /**
   * Get the database connection
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }
    return this.connection;
  }
}

/**
 * Helper function for setting up test database in beforeAll/afterAll hooks
 * 
 * Example usage:
 * 
 * ```typescript
 * const testDb = new TestDatabaseHelper();
 * 
 * beforeAll(async () => {
 *   await testDb.start();
 * });
 * 
 * afterEach(async () => {
 *   await testDb.clearDatabase();
 * });
 * 
 * afterAll(async () => {
 *   await testDb.stop();
 * });
 * ```
 */
export const setupTestDatabase = () => {
  const testDb = new TestDatabaseHelper();

  beforeAll(async () => {
    await testDb.start();
  });

  afterEach(async () => {
    await testDb.clearDatabase();
  });

  afterAll(async () => {
    await testDb.stop();
  });

  return testDb;
};

