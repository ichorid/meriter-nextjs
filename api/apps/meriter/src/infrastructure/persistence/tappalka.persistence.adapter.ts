import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressDocument,
} from '../../domain/models/tappalka/tappalka-progress.schema';
import {
  TappalkaSessionSchemaClass,
  TappalkaSessionDocument,
} from '../../domain/models/tappalka/tappalka-session.schema';
import {
  TAPPALKA_PERSISTENCE_PORT,
  type TappalkaPersistencePort,
  type TappalkaProgressRecord,
  type TappalkaSessionRecord,
} from '../../domain/ports/tappalka.persistence.port';

@Injectable()
export class TappalkaPersistenceAdapter implements TappalkaPersistencePort {
  constructor(
    @InjectModel(TappalkaProgressSchemaClass.name)
    private readonly tappalkaProgressModel: Model<TappalkaProgressDocument>,
    @InjectModel(TappalkaSessionSchemaClass.name)
    private readonly tappalkaSessionModel: Model<TappalkaSessionDocument>,
  ) {}

  async createSession(input: Record<string, unknown>): Promise<TappalkaSessionRecord> {
    const doc = await this.tappalkaSessionModel.create(input);
    return doc.toObject() as TappalkaSessionRecord;
  }

  async claimPendingSession(
    sessionId: string,
    userId: string,
    processingAt: Date,
  ): Promise<TappalkaSessionRecord | null> {
    const doc = await this.tappalkaSessionModel
      .findOneAndUpdate(
        {
          id: sessionId,
          userId,
          status: 'pending',
          expiresAt: { $gt: processingAt },
        },
        {
          $set: {
            status: 'processing',
            updatedAt: processingAt,
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    return doc ? (doc as TappalkaSessionRecord) : null;
  }

  async findConsumedSession(
    sessionId: string,
    userId: string,
  ): Promise<TappalkaSessionRecord | null> {
    const row = await this.tappalkaSessionModel
      .findOne({
        id: sessionId,
        userId,
        status: 'consumed',
        storedResult: { $exists: true },
      })
      .lean()
      .exec();
    return row ? (row as TappalkaSessionRecord) : null;
  }

  async consumeSession(
    sessionId: string,
    result: unknown,
    consumedAt: Date,
    updatedAt: Date,
  ): Promise<void> {
    await this.tappalkaSessionModel
      .updateOne(
        { id: sessionId },
        {
          $set: {
            status: 'consumed',
            consumedAt,
            storedResult: result,
            updatedAt,
          },
        },
      )
      .exec();
  }

  async releaseProcessingSession(sessionId: string, updatedAt: Date): Promise<void> {
    await this.tappalkaSessionModel
      .updateOne(
        { id: sessionId, status: 'processing' },
        { $set: { status: 'pending', updatedAt } },
      )
      .exec();
  }

  async findProgress(
    userId: string,
    communityId: string,
  ): Promise<TappalkaProgressRecord | null> {
    const row = await this.tappalkaProgressModel
      .findOne({ userId, communityId })
      .lean()
      .exec();
    return row ? (row as TappalkaProgressRecord) : null;
  }

  async createProgress(
    input: Record<string, unknown>,
  ): Promise<TappalkaProgressRecord> {
    const doc = await this.tappalkaProgressModel.create(input);
    return doc.toObject() as TappalkaProgressRecord;
  }

  async updateProgress(
    userId: string,
    communityId: string,
    update: {
      set?: Record<string, unknown>;
      inc?: Record<string, number>;
    },
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (update.set && Object.keys(update.set).length > 0) {
      payload.$set = update.set;
    }
    if (update.inc && Object.keys(update.inc).length > 0) {
      payload.$inc = update.inc;
    }
    await this.tappalkaProgressModel
      .updateOne({ userId, communityId }, payload)
      .exec();
  }
}

export const tappalkaPersistenceProvider = {
  provide: TAPPALKA_PERSISTENCE_PORT,
  useClass: TappalkaPersistenceAdapter,
};
