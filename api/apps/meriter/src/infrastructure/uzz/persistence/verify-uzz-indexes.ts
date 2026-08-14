import { Db, Document } from 'mongodb';
import {
  UZZ_REQUIRED_INDEXES,
  UzzIndexKey,
  UzzIndexOptions,
  UzzRequiredIndex,
} from './uzz-index-manifest';

export type UzzIndexVerifyMode = 'verify';

export type UzzIndexSnapshot = {
  key: UzzIndexKey;
  options: UzzIndexOptions;
};

export type UzzIndexMismatch = {
  collection: string;
  index: string;
  expected: UzzIndexSnapshot;
  actual: UzzIndexSnapshot | null;
};

export type UzzIndexVerifyResult = {
  ok: boolean;
  mismatches: UzzIndexMismatch[];
};

export type UzzIndexPreflightLogger = {
  error(message: string): void;
};

export function expectedIndexSnapshot(index: UzzRequiredIndex): UzzIndexSnapshot {
  return {
    key: { ...index.key },
    options: snapshotOptions(index),
  };
}

export function formatUzzIndexMismatches(mismatches: UzzIndexMismatch[]): string {
  const lines = mismatches.map((mismatch) => {
    const actual = mismatch.actual
      ? `actualKey=${JSON.stringify(mismatch.actual.key)} actualOptions=${JSON.stringify(mismatch.actual.options)}`
      : 'actual=missing';
    return `- collection=${mismatch.collection} index=${mismatch.index} expectedKey=${JSON.stringify(mismatch.expected.key)} expectedOptions=${JSON.stringify(mismatch.expected.options)} ${actual}`;
  });
  return `UZZ index preflight failed:\n${lines.join('\n')}`;
}

export async function verifyUzzIndexes(
  db: Db,
  mode: UzzIndexVerifyMode,
): Promise<UzzIndexVerifyResult> {
  if (mode !== 'verify') {
    throw new Error(`Unsupported UZZ index verification mode: ${String(mode)}`);
  }

  const existingNames = new Set(
    (await db.listCollections().toArray()).map((collection) => collection.name),
  );
  const indexesByCollection = new Map<string, Document[]>();
  const mismatches: UzzIndexMismatch[] = [];

  for (const required of UZZ_REQUIRED_INDEXES) {
    const expected = expectedIndexSnapshot(required);
    if (!existingNames.has(required.collection)) {
      mismatches.push({
        collection: required.collection,
        index: required.name,
        expected,
        actual: null,
      });
      continue;
    }

    let actualIndexes = indexesByCollection.get(required.collection);
    if (!actualIndexes) {
      actualIndexes = await db.collection(required.collection).indexes();
      indexesByCollection.set(required.collection, actualIndexes);
    }

    const found = actualIndexes.find((index) => index.name === required.name);
    if (!found) {
      mismatches.push({
        collection: required.collection,
        index: required.name,
        expected,
        actual: null,
      });
      continue;
    }

    const actual = snapshotActualIndex(found);
    if (!sameSnapshot(expected, actual)) {
      mismatches.push({
        collection: required.collection,
        index: required.name,
        expected,
        actual,
      });
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}

export async function runUzzIndexPreflight(
  db: Db | undefined,
  env: NodeJS.ProcessEnv,
  logger: UzzIndexPreflightLogger,
): Promise<void> {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  if (env.UZZ_SKIP_INDEX_PREFLIGHT === 'true') {
    logger.error(
      'UZZ_SKIP_INDEX_PREFLIGHT=true; skipping required index verification (emergency only)',
    );
    return;
  }
  if (!db) {
    throw new Error('Mongo connection is not ready for UZZ index preflight');
  }
  const result = await verifyUzzIndexes(db, 'verify');
  if (!result.ok) {
    throw new Error(formatUzzIndexMismatches(result.mismatches));
  }
}

function snapshotOptions(index: UzzIndexOptions): UzzIndexOptions {
  const options: UzzIndexOptions = {};
  if (index.unique) options.unique = true;
  if (index.expireAfterSeconds !== undefined) {
    options.expireAfterSeconds = index.expireAfterSeconds;
  }
  if (index.partialFilterExpression) {
    options.partialFilterExpression = index.partialFilterExpression;
  }
  return options;
}

function snapshotActualIndex(index: Document): UzzIndexSnapshot {
  const key: UzzIndexKey = {};
  for (const [field, value] of Object.entries(index.key as Document)) {
    key[field] = Number(value) as 1 | -1;
  }
  return {
    key,
    options: snapshotOptions({
      unique: index.unique ? true : undefined,
      expireAfterSeconds:
        typeof index.expireAfterSeconds === 'number'
          ? index.expireAfterSeconds
          : undefined,
      partialFilterExpression: index.partialFilterExpression as
        | Record<string, unknown>
        | undefined,
    }),
  };
}

function sameSnapshot(expected: UzzIndexSnapshot, actual: UzzIndexSnapshot): boolean {
  return (
    JSON.stringify(expected.key) === JSON.stringify(actual.key) &&
    JSON.stringify(expected.options) === JSON.stringify(actual.options)
  );
}
