import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  MeritTransferSchemaClass,
  MeritTransferDocument,
} from '../../domain/models/merit-transfer/merit-transfer.schema';
import {
  MERIT_TRANSFER_PERSISTENCE_PORT,
  type MeritTransferPersistencePort,
  type MeritTransferPersistenceSession,
  type MeritTransferRecord,
} from '../../domain/ports/merit-transfer.persistence.port';

function toRecord(
  doc: MeritTransferDocument | Record<string, unknown>,
): MeritTransferRecord {
  const row =
    'toObject' in doc && typeof doc.toObject === 'function'
      ? doc.toObject()
      : doc;
  return row as MeritTransferRecord;
}

@Injectable()
export class MeritTransferPersistenceAdapter
  implements MeritTransferPersistencePort
{
  constructor(
    @InjectModel(MeritTransferSchemaClass.name)
    private readonly meritTransferModel: Model<MeritTransferDocument>,
  ) {}

  async create(
    input: MeritTransferRecord,
    session?: MeritTransferPersistenceSession,
  ): Promise<MeritTransferRecord> {
    const rows = await this.meritTransferModel.create(
      [{ ...input }],
      session ? { session: session as ClientSession } : undefined,
    );
    return toRecord(rows[0]);
  }

  async findMany(
    filter: Record<string, unknown>,
    options: {
      skip: number;
      limit: number;
      sort: Record<string, 1 | -1>;
    },
  ): Promise<MeritTransferRecord[]> {
    const rows = await this.meritTransferModel
      .find(filter)
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit)
      .lean()
      .exec();
    return rows as MeritTransferRecord[];
  }

  async count(filter: Record<string, unknown>): Promise<number> {
    return this.meritTransferModel.countDocuments(filter).exec();
  }

  async runInTransaction<T>(
    operation: (session: MeritTransferPersistenceSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.meritTransferModel.db.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      if (result === undefined) {
        throw new Error('Merit-transfer transaction produced no result');
      }
      return result;
    } finally {
      await session.endSession();
    }
  }
}

export const meritTransferPersistenceProvider = {
  provide: MERIT_TRANSFER_PERSISTENCE_PORT,
  useClass: MeritTransferPersistenceAdapter,
};
