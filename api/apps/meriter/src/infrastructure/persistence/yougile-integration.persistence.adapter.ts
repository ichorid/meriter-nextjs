import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  YougileIntegration,
  YougileIntegrationDocument,
  YougileEventLogEntry,
} from '../../domain/models/yougile/yougile-integration.schema';
import {
  YougileProcessedEvent,
  YougileProcessedEventDocument,
} from '../../domain/models/yougile/yougile-processed-event.schema';
import {
  YOUGILE_INTEGRATION_PERSISTENCE_PORT,
  type YougileIntegrationPersistencePort,
  type YougileIntegrationRecord,
  type YougileProcessedEventRecord,
} from '../../domain/ports/yougile-integration.persistence.port';

const EVENT_LOG_CAP = 20;

function toRecord(row: unknown): YougileIntegrationRecord | null {
  if (!row) return null;
  const doc = row as YougileIntegration & { _id: unknown };
  return { ...doc, id: String(doc._id) };
}

@Injectable()
export class YougileIntegrationPersistenceAdapter
  implements YougileIntegrationPersistencePort
{
  constructor(
    @InjectModel(YougileIntegration.name)
    private readonly integrationModel: Model<YougileIntegrationDocument>,
    @InjectModel(YougileProcessedEvent.name)
    private readonly processedEventModel: Model<YougileProcessedEventDocument>,
  ) {}

  async findByCommunityId(
    communityId: string,
  ): Promise<YougileIntegrationRecord | null> {
    const row = await this.integrationModel
      .findOne({ communityId })
      .lean()
      .exec();
    return toRecord(row);
  }

  async findById(id: string): Promise<YougileIntegrationRecord | null> {
    const row = await this.integrationModel.findById(id).lean().exec();
    return toRecord(row);
  }

  async create(
    input: Pick<
      YougileIntegration,
      'communityId' | 'apiKey' | 'webhookSecret' | 'connectedByUserId'
    >,
  ): Promise<YougileIntegrationRecord> {
    const doc = await this.integrationModel.create({
      ...input,
      enabled: false,
      eventLog: [],
    });
    return toRecord(doc.toObject()) as YougileIntegrationRecord;
  }

  async update(
    id: string,
    patch: Partial<Record<keyof YougileIntegration, unknown>>,
  ): Promise<YougileIntegrationRecord | null> {
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined) {
        unset[key] = 1;
      } else {
        set[key] = value;
      }
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const row = await this.integrationModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean()
      .exec();
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.integrationModel.findByIdAndDelete(id).exec();
    await this.processedEventModel.deleteMany({ integrationId: id }).exec();
  }

  async markTaskProcessed(
    integrationId: string,
    taskId: string,
  ): Promise<boolean> {
    try {
      await this.processedEventModel.create({ integrationId, taskId });
      return true;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return false;
      }
      throw err;
    }
  }

  async setProcessedPublicationId(
    integrationId: string,
    taskId: string,
    publicationId: string,
  ): Promise<void> {
    await this.processedEventModel
      .updateOne({ integrationId, taskId }, { $set: { publicationId } })
      .exec();
  }

  async releaseTaskClaim(
    integrationId: string,
    taskId: string,
  ): Promise<void> {
    await this.processedEventModel
      .deleteOne({ integrationId, taskId, publicationId: { $exists: false } })
      .exec();
  }

  async listProcessedEvents(
    integrationId: string,
  ): Promise<YougileProcessedEventRecord[]> {
    const rows = await this.processedEventModel
      .find({ integrationId })
      .select({ taskId: 1, publicationId: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return rows.map((row) => ({
      taskId: row.taskId,
      publicationId: row.publicationId,
      createdAt: row.createdAt,
    }));
  }

  async appendEventLog(
    integrationId: string,
    entry: YougileEventLogEntry,
  ): Promise<void> {
    await this.integrationModel
      .updateOne(
        { _id: integrationId },
        {
          $push: {
            eventLog: { $each: [entry], $position: 0, $slice: EVENT_LOG_CAP },
          },
        },
      )
      .exec();
  }
}

export const yougileIntegrationPersistenceProvider = {
  provide: YOUGILE_INTEGRATION_PERSISTENCE_PORT,
  useClass: YougileIntegrationPersistenceAdapter,
};
