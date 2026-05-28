import {
  MongoMemoryReplSet,
  MongoMemoryServer,
} from 'mongodb-memory-server';
import { registerReplSet, registerServer } from './mongo-memory-registry.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = process.env.CI ? 120_000 : 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function retry<T>(
  label: string,
  factory: () => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(500 * attempt);
      }
    }
  }

  throw lastError;
}

export async function createMongoMemoryServerWithRetry(
  options?: ConstructorParameters<typeof MongoMemoryServer.create>[0],
): Promise<MongoMemoryServer> {
  return retry('MongoMemoryServer.create()', async () => {
    const mongod = await withTimeout(
      MongoMemoryServer.create({
        binary: {
          downloadDir: process.env.MONGOMS_DOWNLOAD_DIR,
        },
        instance: {
          dbName: 'test',
        },
        ...options,
      }),
      DEFAULT_TIMEOUT_MS,
      'MongoMemoryServer.create()',
    );
    registerServer(mongod);
    return mongod;
  });
}

export async function createMongoMemoryReplSetWithRetry(
  options?: ConstructorParameters<typeof MongoMemoryReplSet.create>[0],
): Promise<MongoMemoryReplSet> {
  return retry('MongoMemoryReplSet.create()', async () => {
    const replSet = await withTimeout(
      MongoMemoryReplSet.create({
        replSet: { count: 1, dbName: 'test' },
        ...options,
      }),
      DEFAULT_TIMEOUT_MS,
      'MongoMemoryReplSet.create()',
    );
    registerReplSet(replSet);
    return replSet;
  });
}

let sharedMongod: MongoMemoryServer | undefined;
let sharedMongodPromise: Promise<MongoMemoryServer> | undefined;
let suiteCounter = 0;

export function createSuiteDatabaseName(prefix = 'test'): string {
  suiteCounter += 1;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${suiteCounter}_${suffix}`;
}

export async function getSharedMongoMemoryServer(): Promise<MongoMemoryServer> {
  if (sharedMongod) {
    return sharedMongod;
  }

  if (!sharedMongodPromise) {
    sharedMongodPromise = createMongoMemoryServerWithRetry().then((mongod) => {
      sharedMongod = mongod;
      return mongod;
    });
  }

  return sharedMongodPromise;
}

export function getSharedMongoMemoryServerSync(): MongoMemoryServer | undefined {
  return sharedMongod;
}
