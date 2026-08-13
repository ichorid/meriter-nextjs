import type {
  MongoMemoryReplSet,
  MongoMemoryServer,
} from 'mongodb-memory-server';

export function registerServer(server: MongoMemoryServer): void;
export function unregisterServer(server: MongoMemoryServer): void;
export function registerReplSet(replSet: MongoMemoryReplSet): void;
export function unregisterReplSet(replSet: MongoMemoryReplSet): void;
export function stopAllRegistered(options?: { force?: boolean }): Promise<void>;
export function registerSignalHandlers(): void;
export function registerWorkerTeardown(): void;
