import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { UzzRepositories } from '../../../application/uzz/ports/uzz-repositories';
import { UzzUnitOfWork } from '../../../application/uzz/ports/uzz-unit-of-work';
import { createMongooseUzzRepositories } from './mongoose-uzz-repositories';

@Injectable()
export class MongooseUzzUnitOfWork implements UzzUnitOfWork {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<T>(work: (repositories: UzzRepositories) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    let result: T | undefined;
    let completed = false;
    let workError: unknown;

    try {
      await session.withTransaction(async () => {
        try {
          result = await work(createMongooseUzzRepositories(this.connection, session));
          completed = true;
        } catch (error) {
          workError = error;
          throw error;
        }
      });
    } catch (error) {
      throw workError ?? error;
    } finally {
      await session.endSession();
    }

    if (!completed) {
      throw workError ?? new Error('UZZ transaction ended without completing its work');
    }
    return result as T;
  }
}
