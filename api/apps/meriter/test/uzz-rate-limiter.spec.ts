import * as fs from 'node:fs';
import * as path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Model, createConnection } from 'mongoose';
import { UzzRateLimiterPort } from '../src/application/uzz/ports/uzz-identity.port';
import {
  UZZ_RATE_LIMIT_MODEL,
  UzzRateLimitPersistenceSchema,
} from '../src/infrastructure/uzz/persistence/schemas/uzz-rate-limit.schema';
import { MongooseUzzRateLimiter } from '../src/infrastructure/uzz/security/mongoose-uzz-rate-limiter';
import { UzzTokenHasher } from '../src/infrastructure/uzz/security/uzz-token-hasher';
import {
  resolveTrustedClientIp,
  toUzzRateLimitTrpcError,
} from '../src/adapters/trpc/handlers/uzz-app.router';
import { UzzRateLimitedError } from '../src/domain/uzz/errors';
import { createMongoMemoryServerWithRetry } from './mongo-memory-shared';
import { unregisterServer } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');
const CADDYFILE = path.join(__dirname, '../../../../Caddyfile');

describe('Mongo UZZ rate limiter', () => {
  jest.setTimeout(120_000);

  let mongod: MongoMemoryServer;
  let connection: Connection;
  let model: Model<{
    scope: string;
    subjectHash: string;
    windowStart: Date;
    count: number;
    expiresAt: Date;
  }>;
  const hasher = new UzzTokenHasher();

  beforeAll(async () => {
    mongod = await createMongoMemoryServerWithRetry();
    connection = await createConnection(mongod.getUri()).asPromise();
    model = connection.model(UZZ_RATE_LIMIT_MODEL, UzzRateLimitPersistenceSchema);
    await model.init();
  });

  afterEach(async () => {
    await model.deleteMany({});
  });

  afterAll(async () => {
    await connection?.close();
    if (mongod) {
      unregisterServer(mongod);
      await mongod.stop({ doCleanup: true, force: true });
    }
  });

  function createLimiter(): UzzRateLimiterPort {
    return new MongooseUzzRateLimiter(model);
  }

  it('exposes an async consume contract', async () => {
    const limiter = createLimiter();
    const decision = limiter.consume({
      scope: 'magic-link-send-email-cooldown',
      subjectHash: hasher.hash('person@example.test'),
      limit: 1,
      windowMs: 60_000,
      now: NOW,
    });
    expect(decision).toBeInstanceOf(Promise);
    await expect(decision).resolves.toEqual({
      allowed: true,
      remaining: 0,
      resetAt: new Date(NOW.getTime() + 60_000),
    });
  });

  it('allows exactly the configured number of decisions across two shared instances', async () => {
    const first = createLimiter();
    const second = createLimiter();
    const input = {
      scope: 'magic-link-send-ip-hour',
      subjectHash: hasher.hash('203.0.113.9'),
      limit: 5,
      windowMs: 60 * 60 * 1000,
      now: NOW,
    };

    const results = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        (index % 2 === 0 ? first : second).consume(input),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(25);
    expect(await model.countDocuments()).toBe(1);
  });

  it('stores only SHA-256 subject hashes and never raw email, IP or token', async () => {
    const limiter = createLimiter();
    const email = 'person@example.test';
    const ip = '203.0.113.9';
    const token = 'raw-magic-link-token';
    await limiter.consume({
      scope: 'magic-link-send-email-hour',
      subjectHash: hasher.hash(email),
      limit: 5,
      windowMs: 60 * 60 * 1000,
      now: NOW,
    });
    await limiter.consume({
      scope: 'magic-link-redeem-ip',
      subjectHash: hasher.hash(ip),
      limit: 20,
      windowMs: 15 * 60 * 1000,
      now: NOW,
    });
    await limiter.consume({
      scope: 'magic-link-redeem-token',
      subjectHash: hasher.hash(token),
      limit: 10,
      windowMs: 15 * 60 * 1000,
      now: NOW,
    });

    const docs = await model.find().lean();
    const serialized = JSON.stringify(docs);
    expect(docs).toHaveLength(3);
    for (const doc of docs) {
      expect(doc.subjectHash).toMatch(/^[a-f0-9]{64}$/);
      expect(doc).not.toHaveProperty('email');
      expect(doc).not.toHaveProperty('ip');
      expect(doc).not.toHaveProperty('token');
    }
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(ip);
    expect(serialized).not.toContain(token);
  });

  it('uses a unique (scope, subjectHash, windowStart) index and TTL on expiresAt', async () => {
    const indexes = await model.listIndexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          unique: true,
          key: { scope: 1, subjectHash: 1, windowStart: 1 },
        }),
        expect.objectContaining({
          key: { expiresAt: 1 },
          expireAfterSeconds: 0,
        }),
      ]),
    );
  });

  it('opens a new window after the previous window elapses', async () => {
    const limiter = createLimiter();
    const input = {
      scope: 'magic-link-send-email-cooldown',
      subjectHash: hasher.hash('cooldown@example.test'),
      limit: 1,
      windowMs: 60_000,
      now: NOW,
    };
    await expect(limiter.consume(input)).resolves.toMatchObject({ allowed: true });
    await expect(limiter.consume(input)).resolves.toMatchObject({ allowed: false });
    await expect(
      limiter.consume({ ...input, now: new Date(NOW.getTime() + 60_000) }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it('retries the same atomic update once on a duplicate-key race', async () => {
    const resetAt = new Date(NOW.getTime() + 60_000);
    let attempts = 0;
    const stub = {
      findOneAndUpdate: jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }
        return { count: 1, expiresAt: resetAt };
      }),
    };
    const limiter = new MongooseUzzRateLimiter(
      stub as unknown as Model<{
        scope: string;
        subjectHash: string;
        windowStart: Date;
        count: number;
        expiresAt: Date;
      }>,
    );

    await expect(
      limiter.consume({
        scope: 'magic-link-send-email-cooldown',
        subjectHash: hasher.hash('race@example.test'),
        limit: 1,
        windowMs: 60_000,
        now: NOW,
      }),
    ).resolves.toEqual({ allowed: true, remaining: 0, resetAt });
    expect(stub.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(stub.findOneAndUpdate.mock.calls[0]?.[1]).toEqual(
      stub.findOneAndUpdate.mock.calls[1]?.[1],
    );
  });

  it('does not grow process memory for 20,000 unique subjects', async () => {
    const limiter = createLimiter();

    for (let offset = 0; offset < 20_000; offset += 200) {
      await Promise.all(
        Array.from({ length: 200 }, (_, index) =>
          limiter.consume({
            scope: 'cardinality',
            subjectHash: hasher.hash(`subject-${offset + index}`),
            limit: 1,
            windowMs: 60 * 60 * 1000,
            now: NOW,
          }),
        ),
      );
    }

    expect(await model.countDocuments({ scope: 'cardinality' })).toBe(20_000);
    expect(
      Object.values(limiter as object).filter((value) => value instanceof Map),
    ).toHaveLength(0);
    const firstHash = hasher.hash('subject-0');
    const lastHash = hasher.hash('subject-19999');
    const ownState = JSON.stringify({
      names: Object.getOwnPropertyNames(limiter),
      maps: Object.values(limiter as object).filter((value) => value instanceof Map)
        .length,
    });
    expect(ownState).not.toContain(firstHash);
    expect(ownState).not.toContain(lastHash);
  });
});

describe('trusted client address for UZZ rate limits', () => {
  it('configures Caddy to overwrite forwarded client-address instead of appending', () => {
    const caddy = fs.readFileSync(CADDYFILE, 'utf8');
    const uzzBlock = caddy.slice(caddy.indexOf('{$UZZ_DOMAIN'));
    const deleteAt = uzzBlock.indexOf('header_up -X-Forwarded-For');
    const setAt = uzzBlock.indexOf('header_up X-Forwarded-For {remote_host}');

    expect(caddy).not.toMatch(/\+X-Forwarded-For/);
    expect(deleteAt).toBeGreaterThanOrEqual(0);
    expect(setAt).toBeGreaterThan(deleteAt);
  });

  it('does not use a spoofed forwarding header as the limiter subject', () => {
    expect(
      resolveTrustedClientIp({
        ip: '10.0.0.8',
        headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.8' },
        socket: { remoteAddress: '10.0.0.8' },
      }),
    ).toBe('10.0.0.8');
    expect(
      resolveTrustedClientIp({
        headers: { 'x-forwarded-for': '198.51.100.7' },
        socket: { remoteAddress: '10.0.0.8' },
      }),
    ).toBe('10.0.0.8');
    expect(
      resolveTrustedClientIp({
        headers: { 'x-forwarded-for': '198.51.100.7' },
      }),
    ).not.toBe('198.51.100.7');
  });

  it('maps a rate-limit decision to one generic error with retryAfterSeconds', () => {
    const error = new UzzRateLimitedError('UZZ_RATE_LIMITED', 'UZZ_RATE_LIMITED', {
      retryAfterSeconds: 42,
    });
    const trpcError = toUzzRateLimitTrpcError(error);
    expect(trpcError.code).toBe('TOO_MANY_REQUESTS');
    expect(trpcError.message).toBe('Too many login attempts');
    expect(trpcError.message).not.toContain('person@example.test');
    expect(trpcError.cause).toBe(error);
    expect(
      error.details &&
        typeof error.details === 'object' &&
        error.details.retryAfterSeconds,
    ).toBe(42);
  });
});
