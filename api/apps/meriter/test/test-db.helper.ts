import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection, connect } from 'mongoose';
import {
  createSuiteDatabaseName,
  getSharedMongoMemoryServer,
} from './mongo-memory-shared';

/**
 * Test database helper using mongodb-memory-server
 * Provides an in-memory MongoDB instance for integration tests
 */
export class TestDatabaseHelper {
  private mongod?: MongoMemoryServer;
  private connection?: Connection;
  private readonly dbName: string;

  constructor(dbName?: string) {
    this.dbName = dbName ?? createSuiteDatabaseName();
  }

  /**
   * Start the in-memory MongoDB instance.
   * Reuses one mongod per Jest worker; each helper gets its own database name.
   */
  async start(): Promise<string> {
    this.mongod = await getSharedMongoMemoryServer();
    return this.mongod.getUri(this.dbName);
  }

  /**
   * Connect to the in-memory MongoDB instance
   */
  async connect(uri?: string): Promise<Connection> {
    const mongoUri = uri || (await this.start());
    this.connection = (
      await connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        socketTimeoutMS: 3000,
        maxPoolSize: 1,
        retryWrites: false,
        retryReads: false,
      })
    ).connection;
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
      this.connection = undefined;
    }
  }

  /**
   * Close this helper's connection only.
   * The shared worker mongod is stopped via mongo-memory-registry teardown hooks.
   */
  async stop(): Promise<void> {
    await this.closeConnection();
  }

  /**
   * Get the URI of the in-memory MongoDB instance
   */
  getUri(): string {
    if (!this.mongod) {
      throw new Error('MongoDB instance not started');
    }
    return this.mongod.getUri(this.dbName);
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
