import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const SCRIPT = path.join(
  __dirname,
  '../../../../scripts/vps/apply-telegram-profile.sh',
);

const VALID_UUID = 'a1000001-0000-4000-8000-000000000001';

function bashExecutable(): string {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  return fs.existsSync(gitBash) ? gitBash : 'bash';
}

function toBashPath(filePath: string): string {
  const posix = filePath.replace(/\\/g, '/');
  return posix.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
}

function validProdProfile(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    DOMAIN: 'dobro.meriter.pro',
    COMMUNITY_WEB_BASE_URL: 'https://community.example.test',
    UZZ_WEB_BASE_URL: 'https://uzz.example.test',
    DEFAULT_TELEGRAM_COMMUNITY_ID: VALID_UUID,
    ...overrides,
  };
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function runProfile(
  args: string[],
  profileContents: string,
  options?: { seedEnv?: string },
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzz-deploy-profile-'));
  const profileFile = path.join(dir, 'prod.env');
  const envFile = path.join(dir, 'target.env');
  fs.writeFileSync(profileFile, profileContents, 'utf8');
  if (options?.seedEnv !== undefined) {
    fs.writeFileSync(envFile, options.seedEnv, 'utf8');
  }
  const result = spawnSync(bashExecutable(), [toBashPath(SCRIPT), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PROFILE_FILE: toBashPath(profileFile),
      ENV_FILE: toBashPath(envFile),
    },
  });
  return { dir, envFile, result };
}

describe('apply-telegram-profile preflight', () => {
  it.each([
    ['empty', validProdProfile({ DEFAULT_TELEGRAM_COMMUNITY_ID: '' })],
    [
      'placeholder',
      validProdProfile({
        DEFAULT_TELEGRAM_COMMUNITY_ID: 'REPLACE_WITH_PROD_PILOT_COMMUNITY_ID',
      }),
    ],
    ['invalid UUID', validProdProfile({ DEFAULT_TELEGRAM_COMMUNITY_ID: 'not-a-uuid' })],
    [
      'non-HTTPS production URL',
      validProdProfile({ UZZ_WEB_BASE_URL: 'http://uzz.example.test' }),
    ],
  ])('rejects %s in --check without writing the env file', (_label, contents) => {
    const seed = 'SENTINEL=keep\n';
    const { envFile, result } = runProfile(['prod', '--check'], contents, {
      seedEnv: seed,
    });

    expect(result.status).not.toBe(0);
    expect(fs.readFileSync(envFile, 'utf8')).toBe(seed);
  });

  it('does not create an env file when --check succeeds', () => {
    const { envFile, result } = runProfile(['prod', '--check'], validProdProfile());

    expect(result.status).toBe(0);
    expect(fs.existsSync(envFile)).toBe(false);
  });
});
