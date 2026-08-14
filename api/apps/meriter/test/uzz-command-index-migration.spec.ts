import { Collection, Document } from 'mongodb';
import {
  COMPOUND_COMMAND_INDEX,
  COMPOUND_COMMAND_INDEX_KEY,
  migrateUzzCommandIndexes,
  OLD_COMMAND_ID_INDEX,
} from '../../../scripts/migrate-uzz-command-indexes';

type IndexOp = 'createIndex' | 'dropIndex';

const APPLY = {
  apply: true,
  environment: 'TEST',
  confirmation: 'MIGRATE_UZZ_COMMAND_INDEXES_TEST',
} as const;

function createFakeCommandsCollection(options?: {
  failCreate?: boolean;
}) {
  const indexes: Document[] = [
    { name: OLD_COMMAND_ID_INDEX, unique: true, key: { commandId: 1 } },
  ];
  const ops: IndexOp[] = [];
  const collection = {
    indexes: async () => indexes.map((index) => ({ ...index })),
    aggregate: () => ({
      toArray: async () => [],
    }),
    createIndex: async (
      key: Record<string, number>,
      indexOptions: { unique?: boolean; name: string },
    ) => {
      ops.push('createIndex');
      if (options?.failCreate) {
        throw new Error('index build failed');
      }
      if (!indexes.some((index) => index.name === indexOptions.name)) {
        indexes.push({
          name: indexOptions.name,
          key,
          unique: indexOptions.unique,
        });
      }
    },
    dropIndex: async (name: string) => {
      ops.push('dropIndex');
      const idx = indexes.findIndex((index) => index.name === name);
      if (idx >= 0) indexes.splice(idx, 1);
    },
  };
  return {
    collection: collection as unknown as Collection<Document>,
    ops,
    indexes,
  };
}

describe('UZZ command index migration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'table').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates the compound unique index before dropping uzz_commands_id_unique', async () => {
    const { collection, ops, indexes } = createFakeCommandsCollection();

    const result = await migrateUzzCommandIndexes(collection, APPLY);

    expect(ops).toEqual(['createIndex', 'dropIndex']);
    expect(result).toMatchObject({ dropped: true, created: true, dryRun: false });
    expect(indexes.map((index) => index.name)).toEqual([COMPOUND_COMMAND_INDEX]);
    expect(indexes[0]).toMatchObject({
      unique: true,
      key: COMPOUND_COMMAND_INDEX_KEY,
    });
  });

  it('does not drop the old unique index when createIndex fails', async () => {
    const { collection, ops, indexes } = createFakeCommandsCollection({
      failCreate: true,
    });

    await expect(migrateUzzCommandIndexes(collection, APPLY)).rejects.toThrow(
      'index build failed',
    );
    expect(ops).toEqual(['createIndex']);
    expect(indexes.map((index) => index.name)).toEqual([OLD_COMMAND_ID_INDEX]);
  });
});
