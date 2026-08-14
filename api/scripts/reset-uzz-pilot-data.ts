import { Db, MongoClient } from 'mongodb';

export const UZZ_COLLECTIONS = [
  'uzz_settings', 'uzz_rights', 'uzz_listings', 'uzz_deals', 'uzz_ledger',
  'uzz_identities', 'uzz_identity_aliases', 'uzz_identity_tokens',
  'uzz_commands', 'uzz_outbox',
] as const;

const FORBIDDEN_DATABASES = new Set(['test', 'admin', 'local', 'config']);

export interface ResetArguments {
  environment: string;
  expectedHost: string;
  expectedDb: string;
  apply: boolean;
  confirmation: string | null;
}

export interface ResetTarget {
  environment: string;
  expectedHost: string;
  expectedDb: string;
  actualHost: string;
  actualDb: string;
}

interface ParsedMongoTarget {
  host: string;
  database: string;
}

export function resetConfirmationToken(environment: string, database: string): string {
  return `RESET_UZZ_${environment}_${database.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function normalizeHost(hostPort: string): string {
  const trimmed = hostPort.trim();
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return trimmed.slice(1, end).toLowerCase();
  }
  const colon = trimmed.lastIndexOf(':');
  if (colon !== -1 && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return trimmed.slice(0, colon).toLowerCase();
  }
  return trimmed.toLowerCase();
}

function normalizeDatabase(name: string): string {
  return name.trim().toLowerCase();
}

function tryParseUrl(mongoUrl: string): URL | null {
  try {
    return new URL(mongoUrl);
  } catch {
    return null;
  }
}

export function parseMongoTarget(mongoUrl: string): ParsedMongoTarget {
  // MongoClient parses via mongodb-connection-string-url without opening a socket.
  const parsed = new MongoClient(mongoUrl).options;
  const srvHost = parsed.srvHost?.trim().toLowerCase();
  const hosts = [...new Set((parsed.hosts ?? []).map((item) => item.host.toLowerCase()))];
  const host = srvHost || (hosts.length === 1 ? hosts[0] : hosts.slice().sort().join(','));
  const database = (parsed.dbName || '').trim() || 'test';

  const url = tryParseUrl(mongoUrl);
  if (url && host && !host.includes(',')) {
    const urlHost = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (urlHost && urlHost !== '__this_is_a_placeholder__' && urlHost !== host) {
      throw new Error(`Mongo URL host mismatch between ConnectionString and URL (${host} vs ${urlHost})`);
    }
  }

  if (!host) {
    throw new Error('MONGO_URL host is missing');
  }
  return { host, database };
}

export function parseResetArguments(argv: string[]): ResetArguments {
  const value = (prefix: string) => argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '';
  const environment = value('--environment=').trim().toUpperCase();
  if (!environment || !/^[A-Z0-9_-]+$/.test(environment)) {
    throw new Error('Pass --environment=<name>');
  }
  const expectedHost = value('--expected-host=').trim();
  if (!expectedHost) {
    throw new Error('Pass --expected-host=<host>');
  }
  const expectedDb = value('--expected-db=').trim();
  if (!expectedDb) {
    throw new Error('Pass --expected-db=<database>');
  }
  const apply = argv.includes('--apply');
  const confirmation = value('--confirm=').trim() || null;
  const required = resetConfirmationToken(environment, expectedDb);
  if (apply && confirmation !== required) {
    throw new Error(`Apply requires --confirm=${required}`);
  }
  return { environment, expectedHost, expectedDb, apply, confirmation };
}

function isProductionHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h.includes('prod')) return true;
  if (h.split(',').some((part) => part.endsWith('.mongodb.net'))) return true;
  return /\.(com|net|org|pro|io)$/i.test(h);
}

export function formatResetTarget(target: ResetTarget): string {
  return `Resolved UZZ reset target: host=${target.actualHost} database=${target.actualDb} environment=${target.environment}`;
}

function assertTargetMatches(target: ResetTarget): void {
  if (normalizeHost(target.expectedHost) !== target.actualHost) {
    throw new Error(`Host mismatch: expected ${target.expectedHost}, actual ${target.actualHost}`);
  }
  if (normalizeDatabase(target.expectedDb) !== normalizeDatabase(target.actualDb)) {
    throw new Error(`Database mismatch: expected ${target.expectedDb}, actual ${target.actualDb}`);
  }
}

function assertApplyAllowed(target: ResetTarget): void {
  if (target.environment === 'DEV' && isProductionHost(target.actualHost)) {
    throw new Error(`Refusing production MongoDB URL with --environment=DEV (host=${target.actualHost})`);
  }
  if (FORBIDDEN_DATABASES.has(normalizeDatabase(target.actualDb))) {
    throw new Error(`Refusing reset of broad or default database "${target.actualDb}"`);
  }
}

export function prepareReset(argv: string[], mongoUrl: string): {
  args: ResetArguments;
  target: ResetTarget;
  message: string;
} {
  const args = parseResetArguments(argv);
  if (!mongoUrl.trim()) {
    throw new Error('MONGO_URL is required');
  }
  const actual = parseMongoTarget(mongoUrl.trim());
  const target: ResetTarget = {
    environment: args.environment,
    expectedHost: args.expectedHost,
    expectedDb: args.expectedDb,
    actualHost: actual.host,
    actualDb: actual.database,
  };
  assertTargetMatches(target);
  if (args.apply) {
    assertApplyAllowed(target);
  }
  return { args, target, message: formatResetTarget(target) };
}

export async function resetUzzPilotData(db: Pick<Db, 'collection'>, args: ResetArguments) {
  const rows: Array<{ collection: string; count: number; deleted: number }> = [];
  for (const name of UZZ_COLLECTIONS) {
    const collection = db.collection(name);
    const count = await collection.countDocuments({});
    const deleted = args.apply ? (await collection.deleteMany({})).deletedCount : 0;
    rows.push({ collection: name, count, deleted });
  }
  return rows;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  const prepared = prepareReset(process.argv.slice(2), mongoUrl);
  console.log(prepared.message);
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    const rows = await resetUzzPilotData(client.db(), prepared.args);
    console.table(rows);
    console.log(
      prepared.args.apply
        ? `UZZ reset applied in ${prepared.args.environment}`
        : `Dry run for ${prepared.args.environment}; add --apply and the confirmation token to delete`,
    );
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
