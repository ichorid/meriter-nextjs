import { Db, MongoClient } from 'mongodb';

export const UZZ_COLLECTIONS = [
  'uzz_settings', 'uzz_rights', 'uzz_listings', 'uzz_deals', 'uzz_ledger',
  'uzz_identities', 'uzz_identity_aliases', 'uzz_identity_tokens',
  'uzz_commands', 'uzz_outbox',
] as const;

export interface ResetArguments {
  environment: string;
  apply: boolean;
  confirmation: string | null;
}

export function parseResetArguments(argv: string[]): ResetArguments {
  const value = (prefix: string) => argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '';
  const environment = value('--environment=').trim().toUpperCase();
  if (!environment || !/^[A-Z0-9_-]+$/.test(environment)) {
    throw new Error('Pass --environment=<name>');
  }
  const apply = argv.includes('--apply');
  const confirmation = value('--confirm=').trim() || null;
  if (apply && confirmation !== `RESET_UZZ_${environment}`) {
    throw new Error(`Apply requires --confirm=RESET_UZZ_${environment}`);
  }
  return { environment, apply, confirmation };
}

export async function resetUzzPilotData(db: Pick<Db, 'collection'>, args: ResetArguments) {
  const rows: Array<{ collection: string; count: number; deleted: number }> = [];
  for (const name of UZZ_COLLECTIONS) {
    const collection = db.collection(name);
    const count = await collection.countDocuments({});
    const deleted = args.apply ? (await collection.deleteMany({})).deletedCount : 0;
    rows.push({ collection: name, count, deleted });
  }
  return rows;
}

async function main() {
  const args = parseResetArguments(process.argv.slice(2));
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    const rows = await resetUzzPilotData(client.db(), args);
    console.table(rows);
    console.log(args.apply ? `UZZ reset applied in ${args.environment}` : `Dry run for ${args.environment}; add --apply and the confirmation token to delete`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
