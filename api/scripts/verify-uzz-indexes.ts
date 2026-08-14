import { Db, MongoClient } from 'mongodb';
import {
  formatUzzIndexMismatches,
  verifyUzzIndexes,
} from '../apps/meriter/src/infrastructure/uzz/persistence/verify-uzz-indexes';

export async function runVerifyUzzIndexesCli(db: Db): Promise<number> {
  const result = await verifyUzzIndexes(db, 'verify');
  if (result.ok) {
    return 0;
  }
  console.error(formatUzzIndexMismatches(result.mismatches));
  return 1;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    process.exitCode = await runVerifyUzzIndexesCli(client.db());
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
