import { spawnSync } from 'node:child_process';

function getEnvInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function run() {
  const runs = getEnvInt('E2E_RUNS', 3);
  const maxWorkers = process.env.E2E_MAX_WORKERS || (process.env.CI ? '2' : '50%');
  const randomize = (process.env.E2E_RANDOMIZE ?? 'false').toLowerCase() === 'true';

  const baseArgs = [
    '--config',
    './apps/meriter/test/jest-e2e.json',
    '--bail',
    `--maxWorkers=${maxWorkers}`,
  ];

  for (let i = 1; i <= runs; i += 1) {
    const seed = (Date.now() + i) % 4294967296;
    const args = [...baseArgs];
    if (randomize) {
      args.push('--randomize');
      args.push(`--seed=${seed}`);
    }

    // eslint-disable-next-line no-console
    console.log(`\n[E2E STRESS] Run ${i}/${runs} (maxWorkers=${maxWorkers}${randomize ? `, seed=${seed}` : ''})\n`);

    const result = spawnSync('./node_modules/.bin/jest', args, {
      stdio: 'inherit',
      env: process.env,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

run();


