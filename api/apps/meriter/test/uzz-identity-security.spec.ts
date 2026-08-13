import { ConfigService } from '@nestjs/config';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { ConfirmTelegramLinkUseCase } from '../src/application/uzz/use-cases/confirm-telegram-link.use-case';
import { RedeemUzzMagicLinkUseCase } from '../src/application/uzz/use-cases/redeem-uzz-magic-link.use-case';
import { StartTelegramLinkUseCase } from '../src/application/uzz/use-cases/start-telegram-link.use-case';
import { AppConfig } from '../src/config/configuration';
import {
  AuthMagicLink,
  AuthMagicLinkSchema,
} from '../src/domain/models/auth/auth-magic-link.schema';
import { UzzRateLimitedError } from '../src/domain/uzz/errors';
import { AuthMagicLinkService } from '../src/infrastructure/auth/magic-link-auth.service';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { InMemoryUzzRateLimiter } from '../src/infrastructure/uzz/security/uzz-rate-limiter';
import { UzzTokenHasher } from '../src/infrastructure/uzz/security/uzz-token-hasher';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

describe('UZZ identity security', () => {
  jest.setTimeout(60_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let uow: MongooseUzzUnitOfWork;
  let magicLinks: AuthMagicLinkService;
  let hasher: UzzTokenHasher;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'uzz-identity-security-test' },
    });
    connection = await createConnection(replSet.getUri()).asPromise();
    await initializeUzzModels(connection);
    const magicLinkModel = connection.model(AuthMagicLink.name, AuthMagicLinkSchema);
    await magicLinkModel.init();
    const config = new ConfigService<AppConfig>({
      magicLink: {
        baseUrl: 'https://uzz.example.test',
        path: '/a',
        ttlMinutes: 15,
      },
    } as AppConfig);
    magicLinks = new AuthMagicLinkService(config, magicLinkModel);
    uow = new MongooseUzzUnitOfWork(connection);
    hasher = new UzzTokenHasher();
  });

  afterEach(async () => {
    const collections = await connection.db.listCollections().toArray();
    await Promise.all(
      collections.map(({ name }) => connection.db.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection?.close();
    if (replSet) {
      unregisterReplSet(replSet);
      await replSet.stop();
    }
  });

  it('allows only one of two concurrent email magic-link redeems', async () => {
    const { token } = await magicLinks.createToken('email', 'user@example.com');
    const gateway = createIdentityGateway();
    const redeem = new RedeemUzzMagicLinkUseCase(
      magicLinks,
      gateway,
      uow,
      hasher,
      new InMemoryUzzRateLimiter(),
    );

    const results = await Promise.allSettled([
      redeem.execute({ token, ip: '127.0.0.1', now: NOW }),
      redeem.execute({ token, ip: '127.0.0.1', now: NOW }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const stored = await connection.db
      .collection('authmagiclinks')
      .findOne({ channel: 'email' });
    expect(stored?.tokenHash).toHaveLength(64);
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('stores only a hash for a 128-bit Telegram link token and consumes it once', async () => {
    const repositories = createMongooseUzzRepositories(connection, null);
    await repositories.identities.insert({
      id: 'identity-1',
      canonicalUserId: 'user-1',
      normalizedEmail: 'user@example.com',
      telegramUserId: null,
      telegramUsername: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 0,
    });
    const limiter = new InMemoryUzzRateLimiter();
    const start = new StartTelegramLinkUseCase(uow, hasher, limiter);
    const confirm = new ConfirmTelegramLinkUseCase(uow, hasher, limiter);

    const started = await start.execute({ userId: 'user-1', now: NOW });
    expect(started.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const row = await connection.db
      .collection('uzz_identity_tokens')
      .findOne({ identityId: 'identity-1' });
    expect(row?.tokenHash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(started.token);

    await expect(
      confirm.execute({
        token: started.token,
        telegramUserId: '1001',
        telegramUsername: 'telegram_user',
        now: new Date('2026-08-14T00:01:00.000Z'),
      }),
    ).resolves.toMatchObject({ canonicalUserId: 'user-1' });
    await expect(
      confirm.execute({
        token: started.token,
        telegramUserId: '1001',
        telegramUsername: 'telegram_user',
        now: new Date('2026-08-14T00:02:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'IDENTITY_TOKEN_INVALID' });

    expect(await repositories.identities.findByTelegramUserId('1001')).toMatchObject({
      canonicalUserId: 'user-1',
      telegramUsername: 'telegram_user',
    });
  });

  it('rate-limits repeated invalid magic-link attempts inside the use case', async () => {
    const limiter = new InMemoryUzzRateLimiter();
    const redeem = new RedeemUzzMagicLinkUseCase(
      magicLinks,
      createIdentityGateway(),
      uow,
      hasher,
      limiter,
      { attemptsPerWindow: 1, windowMs: 60_000 },
    );

    await expect(
      redeem.execute({ token: 'invalid-token', ip: '127.0.0.1', now: NOW }),
    ).rejects.toMatchObject({ code: 'MAGIC_LINK_INVALID' });
    await expect(
      redeem.execute({ token: 'invalid-token', ip: '127.0.0.1', now: NOW }),
    ).rejects.toBeInstanceOf(UzzRateLimitedError);
  });

  it('coexists with the legacy unique token index without storing raw tokens', async () => {
    const collection = connection.db.collection('authmagiclinks');
    await collection.createIndex(
      { token: 1 },
      { unique: true, name: 'legacy_magic_token_unique' },
    );

    const first = await magicLinks.createToken('email', 'first@example.com');
    const second = await magicLinks.createToken('email', 'second@example.com');
    const rows = await collection.find({ channel: 'email' }).toArray();

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.token).toMatch(/^[a-f0-9]{64}$/);
      expect(row.token).toBe(row.tokenHash);
    }
    expect(JSON.stringify(rows)).not.toContain(first.token);
    expect(JSON.stringify(rows)).not.toContain(second.token);
  });
});

function createIdentityGateway() {
  const user = { id: 'user-1', displayName: 'User One' };
  return {
    async authenticateEmail(_email: string) {
      return { user, jwt: 'jwt-token', isNewUser: true };
    },
    async findUserByEmail(_email: string) {
      return null;
    },
    async linkEmailIdentity(_userId: string, _email: string) {},
    async findUserById(userId: string) {
      return userId === user.id ? user : null;
    },
  };
}
