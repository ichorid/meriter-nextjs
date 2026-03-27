import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';

const { EJSON } = mongoose.mongo.BSON;
import { DATABASE_DUMP_VERSION } from '../common/constants/platform-database-dump.constants';

export type MeriterDatabaseDumpV1 = {
  version: typeof DATABASE_DUMP_VERSION;
  exportedAt: string;
  databaseName: string;
  collections: Record<string, unknown[]>;
};

const BATCH = 500;

@Injectable()
export class PlatformDatabaseDumpService {
  private readonly logger = new Logger(PlatformDatabaseDumpService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async exportAll(): Promise<MeriterDatabaseDumpV1> {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection has no database handle');
    }

    const collections: Record<string, unknown[]> = {};
    const infos = await db.listCollections().toArray();
    const names = infos
      .map((i) => i.name)
      .filter(
        (n): n is string =>
          typeof n === 'string' && n.length > 0 && !n.startsWith('system.'),
      )
      .sort();

    for (const name of names) {
      const docs = await db.collection(name).find({}).toArray();
      collections[name] = docs.map((d) => EJSON.serialize(d));
    }

    const totalDocs = Object.values(collections).reduce((a, x) => a + x.length, 0);
    this.logger.warn(
      `Database dump export: ${names.length} collections, ${totalDocs} documents`,
    );

    return {
      version: DATABASE_DUMP_VERSION,
      exportedAt: new Date().toISOString(),
      databaseName: db.databaseName,
      collections,
    };
  }

  async restoreFromDump(dump: MeriterDatabaseDumpV1): Promise<{
    collectionsRestored: number;
    documentsInserted: number;
  }> {
    if (dump.version !== DATABASE_DUMP_VERSION) {
      throw new BadRequestException('Unsupported database dump version');
    }
    if (!dump.collections || typeof dump.collections !== 'object') {
      throw new BadRequestException('Invalid dump: collections');
    }

    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection has no database handle');
    }

    const existing = (await db.listCollections().toArray())
      .map((i) => i.name)
      .filter(
        (n): n is string =>
          typeof n === 'string' && n.length > 0 && !n.startsWith('system.'),
      )
      .sort();

    for (const name of existing) {
      const r = await db.collection(name).deleteMany({});
      this.logger.warn(`Restore: cleared ${name} (${r.deletedCount} docs)`);
    }

    const incomingNames = Object.keys(dump.collections).sort();
    let documentsInserted = 0;

    for (const name of incomingNames) {
      const rawDocs = dump.collections[name];
      if (!Array.isArray(rawDocs)) {
        throw new BadRequestException(
          `Invalid dump: collections.${name} must be an array`,
        );
      }
      if (rawDocs.length === 0) continue;

      const coll = db.collection(name);
      for (let i = 0; i < rawDocs.length; i += BATCH) {
        const slice = rawDocs
          .slice(i, i + BATCH)
          .map((raw) => EJSON.deserialize(raw as Record<string, unknown>));
        await coll.insertMany(slice, { ordered: false });
        documentsInserted += slice.length;
      }
      this.logger.warn(`Restore: inserted ${rawDocs.length} into ${name}`);
    }

    this.logger.warn(
      `Database restore completed: ${incomingNames.length} collections, ${documentsInserted} documents`,
    );

    return {
      collectionsRestored: incomingNames.length,
      documentsInserted,
    };
  }
}
