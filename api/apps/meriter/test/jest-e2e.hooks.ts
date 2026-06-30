import { stopSharedMongoMemoryServer } from './mongo-memory-shared';

/** E2E suites boot Nest + in-memory Mongo; default 5s hook timeout is too low on Windows CI. */
jest.setTimeout(30000);

/**
 * Stop the worker-shared mongod after each suite file. The mongod child process
 * otherwise keeps the worker event loop alive and Jest hangs after a green run.
 */
afterAll(async () => {
  await stopSharedMongoMemoryServer();
}, 30000);
