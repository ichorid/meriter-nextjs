import {
  formatResetTarget,
  parseResetArguments,
  prepareReset,
  resetUzzPilotData,
  UZZ_COLLECTIONS,
} from '../../../scripts/reset-uzz-pilot-data';
import { MongoClient } from 'mongodb';

const DEV_APPLY = [
  '--environment=DEV',
  '--expected-host=127.0.0.1',
  '--expected-db=meriter_dev',
  '--apply',
  '--confirm=RESET_UZZ_DEV_MERITER_DEV',
];

const DEV_MONGO_URL = 'mongodb://127.0.0.1:27017/meriter_dev';

describe('reset UZZ pilot data safety', () => {
  it('requires environment, expected host and expected database', () => {
    expect(() => parseResetArguments([])).toThrow('--environment=');
    expect(() => parseResetArguments(['--environment=DEV'])).toThrow('--expected-host=');
    expect(() => parseResetArguments(['--environment=DEV', '--expected-host=127.0.0.1'])).toThrow(
      '--expected-db=',
    );
  });

  it('is a dry run unless --apply and a host/database-bound confirmation are present', () => {
    const dry = parseResetArguments([
      '--environment=DEV',
      '--expected-host=127.0.0.1',
      '--expected-db=meriter_dev',
    ]);
    expect(dry).toEqual({
      environment: 'DEV',
      expectedHost: '127.0.0.1',
      expectedDb: 'meriter_dev',
      apply: false,
      confirmation: null,
    });
    expect(() =>
      parseResetArguments([
        '--environment=DEV',
        '--expected-host=127.0.0.1',
        '--expected-db=meriter_dev',
        '--apply',
      ]),
    ).toThrow('RESET_UZZ_DEV_MERITER_DEV');
    expect(
      parseResetArguments(DEV_APPLY).apply,
    ).toBe(true);
  });

  it('rejects the old environment-only confirmation string', () => {
    expect(() =>
      parseResetArguments([
        '--environment=DEV',
        '--expected-host=127.0.0.1',
        '--expected-db=meriter_dev',
        '--apply',
        '--confirm=RESET_UZZ_DEV',
      ]),
    ).toThrow('RESET_UZZ_DEV_MERITER_DEV');
  });

  it('refuses a production URL with --environment=DEV before connecting', () => {
    const connect = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as never);
    expect(() =>
      prepareReset(
        [
          '--environment=DEV',
          '--expected-host=prod-mongo.example.com',
          '--expected-db=meriter_dev',
          '--apply',
          '--confirm=RESET_UZZ_DEV_MERITER_DEV',
        ],
        'mongodb://prod-mongo.example.com:27017/meriter_dev',
      ),
    ).toThrow(/production/i);
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('refuses a host mismatch before connecting', () => {
    const connect = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as never);
    expect(() =>
      prepareReset(DEV_APPLY, 'mongodb://10.0.0.8:27017/meriter_dev'),
    ).toThrow(/host/i);
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('refuses a database mismatch before connecting', () => {
    const connect = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as never);
    expect(() =>
      prepareReset(DEV_APPLY, 'mongodb://127.0.0.1:27017/meriter'),
    ).toThrow(/database/i);
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it.each(['test', 'admin', 'local', 'config', ''])(
    'refuses broad or default database name %j on apply',
    (database) => {
      const url = database
        ? `mongodb://127.0.0.1:27017/${database}`
        : 'mongodb://127.0.0.1:27017';
      const expectedDb = database || 'test';
      expect(() =>
        prepareReset(
          [
            `--environment=DEV`,
            '--expected-host=127.0.0.1',
            `--expected-db=${expectedDb}`,
            '--apply',
            `--confirm=RESET_UZZ_DEV_${expectedDb.toUpperCase()}`,
          ],
          url,
        ),
      ).toThrow(/database/i);
    },
  );

  it('prints the resolved host and database on dry-run without connecting', () => {
    const connect = jest.spyOn(MongoClient.prototype, 'connect').mockResolvedValue(undefined as never);
    const prepared = prepareReset(
      ['--environment=DEV', '--expected-host=127.0.0.1', '--expected-db=meriter_dev'],
      DEV_MONGO_URL,
    );
    expect(prepared.target).toEqual({
      environment: 'DEV',
      expectedHost: '127.0.0.1',
      expectedDb: 'meriter_dev',
      actualHost: '127.0.0.1',
      actualDb: 'meriter_dev',
    });
    expect(prepared.message).toMatch(/127\.0\.0\.1/);
    expect(prepared.message).toMatch(/meriter_dev/);
    expect(formatResetTarget(prepared.target)).toBe(prepared.message);
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });

  it('accepts the required apply invocation for the local meriter_dev target', () => {
    const prepared = prepareReset(DEV_APPLY, DEV_MONGO_URL);
    expect(prepared.args.apply).toBe(true);
    expect(prepared.target.actualHost).toBe('127.0.0.1');
    expect(prepared.target.actualDb).toBe('meriter_dev');
  });

  it('touches only the literal UZZ allowlist', async () => {
    const touched: string[] = [];
    const deleted: string[] = [];
    const db = {
      collection: (name: string) => ({
        countDocuments: async () => {
          touched.push(name);
          return 1;
        },
        deleteMany: async () => {
          deleted.push(name);
          return { deletedCount: 1 };
        },
      }),
    };
    await resetUzzPilotData(db as never, {
      environment: 'DEV',
      expectedHost: '127.0.0.1',
      expectedDb: 'meriter_dev',
      apply: true,
      confirmation: 'RESET_UZZ_DEV_MERITER_DEV',
    });
    expect(touched).toEqual([...UZZ_COLLECTIONS]);
    expect(deleted).toEqual([...UZZ_COLLECTIONS]);
    expect(touched).not.toEqual(expect.arrayContaining(['users', 'wallets', 'publications', 'communities']));
  });

  it('does not delete during a dry run', async () => {
    const deleteMany = jest.fn();
    const db = { collection: () => ({ countDocuments: async () => 2, deleteMany }) };
    const rows = await resetUzzPilotData(db as never, {
      environment: 'DEV',
      expectedHost: '127.0.0.1',
      expectedDb: 'meriter_dev',
      apply: false,
      confirmation: null,
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(rows.every((row) => row.deleted === 0)).toBe(true);
  });
});
