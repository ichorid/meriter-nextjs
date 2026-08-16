import { MongoClient } from 'mongodb';
import {
  grantTesterKit,
  parseSeedArguments,
  prepareSeed,
  seedConfirmationToken,
  seedHumanDemoWorld,
  selectCommunityByName,
} from '../../../scripts/seed-uzz-human-demo';
import { withMockMarker } from '../../../scripts/uzz-human-demo-world';

const DEV_APPLY = [
  '--environment=DEV',
  '--expected-host=127.0.0.1',
  '--expected-db=meriter_dev',
  '--apply',
  '--confirm=SEED_UZZ_DEV_MERITER_DEV',
];

describe('UZZ human demo seed safety', () => {
  it('requires environment, host, database and a seed-specific confirmation', () => {
    expect(() => parseSeedArguments([])).toThrow('--environment=');
    expect(seedConfirmationToken('DEV', 'meriter_dev')).toBe('SEED_UZZ_DEV_MERITER_DEV');
    expect(withMockMarker('Анна Соколова')).toBe('[мок] Анна Соколова');
    expect(withMockMarker('[мок] Анна Соколова')).toBe('[мок] Анна Соколова');
    expect(parseSeedArguments([
      '--environment=DEV',
      '--expected-host=mongodb',
      '--expected-db=meriter',
      '--community-name=Meriter Dev Chat',
      '--set-stand',
    ]).communityName).toBe('Meriter Dev Chat');
    expect(selectCommunityByName([
      { id: 'chat', name: 'Meriter Dev Chat', telegramChatId: '-1001' },
      { id: 'bot', name: 'Test Meriter Dev Bot 3', telegramChatId: '-1002' },
    ], 'Meriter Dev Chat').id).toBe('chat');
    expect(() =>
      parseSeedArguments([
        '--environment=DEV',
        '--expected-host=127.0.0.1',
        '--expected-db=meriter_dev',
        '--apply',
      ]),
    ).toThrow('SEED_UZZ_DEV_MERITER_DEV');
  });

  it('refuses production environment and cw.ru before connecting', () => {
    const connect = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as never);
    expect(() =>
      prepareSeed(
        ['--environment=PRODUCTION', '--expected-host=127.0.0.1', '--expected-db=meriter_dev'],
        'mongodb://127.0.0.1:27017/meriter_dev',
      ),
    ).toThrow(/PRODUCTION/i);
    expect(() =>
      prepareSeed(DEV_APPLY, 'mongodb://127.0.0.1:27017/meriter_dev', { uzzDomain: 'cw.ru' }),
    ).toThrow(/cw\.ru/i);
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });
});

describe('UZZ human demo world', () => {
  function memoryDb() {
    const store = new Map<string, Map<string, Record<string, unknown>>>();
    const collection = (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const rows = store.get(name)!;
      const keyOf = (doc: Record<string, unknown>) =>
        String(doc.id ?? doc.communityId ?? `${doc.userId}:${doc.communityId}`);
      return {
        async updateOne(filter: Record<string, unknown>, update: { $set?: object; $setOnInsert?: object; $addToSet?: Record<string, unknown> }, options?: { upsert?: boolean }) {
          const match = [...rows.values()].find((row) =>
            Object.entries(filter).every(([key, value]) => row[key] === value),
          );
          if (match) {
            Object.assign(match, update.$set ?? {});
            return { matchedCount: 1, upsertedCount: 0 };
          }
          if (!options?.upsert) return { matchedCount: 0, upsertedCount: 0 };
          const inserted = { ...(update.$setOnInsert ?? {}), ...(update.$set ?? {}), ...filter };
          rows.set(keyOf(inserted), inserted);
          return { matchedCount: 0, upsertedCount: 1 };
        },
        async findOne(filter: Record<string, unknown>) {
          return [...rows.values()].find((row) =>
            Object.entries(filter).every(([key, value]) => row[key] === value),
          ) ?? null;
        },
        async countDocuments(filter: Record<string, unknown> = {}) {
          return [...rows.values()].filter((row) =>
            Object.entries(filter).every(([key, value]) => row[key] === value),
          ).length;
        },
      };
    };
    return { collection, store };
  }

  it('upserts a lived-in NPC world with invalid emails and is idempotent', async () => {
    const db = memoryDb();
    const now = new Date('2026-08-16T12:00:00.000Z');
    const first = await seedHumanDemoWorld(db, {
      communityId: 'a1000001-0000-4000-8000-000000000001',
      now,
      apply: true,
    });
    const second = await seedHumanDemoWorld(db, {
      communityId: 'a1000001-0000-4000-8000-000000000001',
      now,
      apply: true,
    });

    expect(first.users).toBe(8);
    expect(first.listings).toBeGreaterThanOrEqual(6);
    expect(first.deals).toBeGreaterThanOrEqual(4);
    expect(second.users).toBe(first.users);
    expect(await db.collection('users').countDocuments({ uzzHumanDemo: true })).toBe(8);
    expect(await db.collection('uzz_listings').countDocuments({ uzzHumanDemo: true })).toBe(first.listings);

    const anna = await db.collection('users').findOne({ id: 'a2000001-0000-4000-8000-000000000001' });
    expect(anna?.displayName).toBe('[мок] Анна Соколова');
    expect(String(anna?.authId)).toMatch(/@uzz-demo\.invalid$/);
    const listing = await db.collection('uzz_listings').findOne({ id: 'a2300001-0000-4000-8000-000000000001' });
    expect(String(listing?.title)).toMatch(/^\[мок\] /);
  });

  it('grants a tester kit only after the user already exists', async () => {
    const db = memoryDb();
    await expect(
      grantTesterKit(db, {
        email: 'tester@example.org',
        communityId: 'a1000001-0000-4000-8000-000000000001',
        merits: 40,
        now: new Date('2026-08-16T12:00:00.000Z'),
      }),
    ).rejects.toThrow('USER_NOT_FOUND');

    await db.collection('users').updateOne(
      { id: 'tester-1' },
      {
        $setOnInsert: {
          id: 'tester-1',
          authId: 'tester@example.org',
          displayName: 'Тестер',
          communityMemberships: [],
        },
      },
      { upsert: true },
    );
    await db.collection('user_auth_identities').updateOne(
      { id: 'auth-tester-1' },
      {
        $setOnInsert: {
          id: 'auth-tester-1',
          userId: 'tester-1',
          provider: 'email',
          authId: 'tester@example.org',
        },
      },
      { upsert: true },
    );

    const kit = await grantTesterKit(db, {
      email: 'tester@example.org',
      communityId: 'a1000001-0000-4000-8000-000000000001',
      merits: 40,
      now: new Date('2026-08-16T12:00:00.000Z'),
    });
    expect(kit.userId).toBe('tester-1');
    expect(kit.merits).toBe(40);
    const identity = await db.collection('uzz_identities').findOne({ canonicalUserId: 'tester-1' });
    expect(identity?.normalizedEmail).toBe('tester@example.org');
    expect(identity?.telegramUserId).toBeNull();
  });
});
