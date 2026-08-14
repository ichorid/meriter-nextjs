import { Collection, Document, MongoClient } from 'mongodb';

export const OLD_COMMAND_ID_INDEX = 'uzz_commands_id_unique';
export const COMPOUND_COMMAND_INDEX = 'uzz_commands_actor_command_unique';
export const COMPOUND_COMMAND_INDEX_KEY = { actorId: 1, commandId: 1 } as const;

export interface CommandIndexMigrationArgs {
  apply: boolean;
  environment: string | null;
  confirmation: string | null;
}

export function parseCommandIndexMigrationArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): CommandIndexMigrationArgs {
  const value = (prefix: string) =>
    argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
  const apply = argv.includes('--apply');
  const environment = value('--environment=').toUpperCase() || null;
  const confirmation =
    value('--confirm=') || env.UZZ_COMMAND_INDEX_MIGRATE_CONFIRM?.trim() || null;
  if (apply) {
    if (!environment || !/^[A-Z0-9_-]+$/.test(environment)) {
      throw new Error('Apply requires --environment=<name>');
    }
    const expected = `MIGRATE_UZZ_COMMAND_INDEXES_${environment}`;
    if (confirmation !== expected) {
      throw new Error(
        `Apply requires --confirm=${expected} or UZZ_COMMAND_INDEX_MIGRATE_CONFIRM=${expected}`,
      );
    }
  }
  return { apply, environment, confirmation };
}

export async function migrateUzzCommandIndexes(
  collection: Collection<Document>,
  args: CommandIndexMigrationArgs,
): Promise<{
  dryRun: boolean;
  indexes: Document[];
  duplicates: number;
  dropped: boolean;
  created: boolean;
}> {
  const indexes = await collection.indexes();
  console.log('Current uzz_commands indexes:');
  console.table(
    indexes.map((index) => ({
      name: index.name,
      unique: Boolean(index.unique),
      key: JSON.stringify(index.key),
    })),
  );

  const duplicates = await collection
    .aggregate<{ count: number }>([
      {
        $group: {
          _id: { actorId: '$actorId', commandId: '$commandId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  if (duplicates.length > 0) {
    throw new Error(
      `Refusing index change: ${duplicates.length} unexpected duplicate (actorId, commandId) row group(s)`,
    );
  }

  const hasOld = indexes.some((index) => index.name === OLD_COMMAND_ID_INDEX);
  const hasCompound = indexes.some((index) => index.name === COMPOUND_COMMAND_INDEX);
  console.log(
    args.apply
      ? 'Applying index migration'
      : 'Dry run; pass --apply with environment confirmation to mutate indexes',
  );
  console.log(
    `${args.apply ? 'Will drop' : 'Would drop'} ${OLD_COMMAND_ID_INDEX}: ${hasOld ? 'present' : 'already absent'}`,
  );
  console.log(
    `${args.apply ? 'Will create' : 'Would create'} ${COMPOUND_COMMAND_INDEX}: ${hasCompound ? 'already present' : 'missing'}`,
  );

  if (!args.apply) {
    return {
      dryRun: true,
      indexes,
      duplicates: 0,
      dropped: false,
      created: false,
    };
  }

  let dropped = false;
  if (hasOld) {
    await collection.dropIndex(OLD_COMMAND_ID_INDEX);
    dropped = true;
  }

  await collection.createIndex(COMPOUND_COMMAND_INDEX_KEY, {
    unique: true,
    name: COMPOUND_COMMAND_INDEX,
  });

  const verified = (await collection.indexes()).find(
    (index) => index.name === COMPOUND_COMMAND_INDEX,
  );
  const keyMatches =
    verified &&
    Object.keys(verified.key).length === 2 &&
    verified.key.actorId === 1 &&
    verified.key.commandId === 1;
  if (!verified?.unique || !keyMatches) {
    throw new Error('Compound unique index verification failed');
  }

  return {
    dryRun: false,
    indexes: await collection.indexes(),
    duplicates: 0,
    dropped,
    created: true,
  };
}

async function main() {
  const args = parseCommandIndexMigrationArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    const result = await migrateUzzCommandIndexes(
      client.db().collection('uzz_commands'),
      args,
    );
    console.log(
      result.dryRun
        ? 'Dry run complete; no indexes changed'
        : `Applied: dropped=${result.dropped} created=${result.created}`,
    );
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
