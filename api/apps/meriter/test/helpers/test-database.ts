import { Connection } from 'mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';

export class TestDatabase {
  private connection: Connection;
  
  async setupDatabase(module: TestingModule): Promise<void> {
    this.connection = module.get(Connection);
    await this.connection.db.dropDatabase();
  }
  
  async teardownDatabase(): Promise<void> {
    if (this.connection) {
      await this.connection.db.dropDatabase();
      await this.connection.close();
    }
  }
  
  async clearCollections(collections: string[]): Promise<void> {
    for (const collection of collections) {
      await this.connection.db.collection(collection).deleteMany({});
    }
  }
  
  getConnection(): Connection {
    return this.connection;
  }
}

export function createTestModule() {
  return Test.createTestingModule({
    imports: [
      MongooseModule.forRoot('mongodb://localhost:27017/test-meriter'),
      // Import all modules needed for testing
    ],
  });
}

