import { existsSync } from 'fs';
import { join } from 'path';

const DEMO_PROJECTS_FILE = 'meriter-demo-projects.tsv';

/**
 * Resolve UTF-8 Meriter_Demo_Projects TSV (repo layout, dist copy, or cwd variants).
 */
export function resolveMeriterDemoProjectsTsvPath(): string {
  const candidates = [
    // Docker / production: WORKDIR /app, CMD node dist/apps/meriter/main, TSV copied next to bundle
    join(process.cwd(), 'dist', 'apps', 'meriter', 'seed-data', DEMO_PROJECTS_FILE),
    join(process.cwd(), 'apps', 'meriter', 'seed-data', DEMO_PROJECTS_FILE),
    join(process.cwd(), 'seed-data', DEMO_PROJECTS_FILE),
    join(__dirname, '..', '..', 'seed-data', DEMO_PROJECTS_FILE),
    join(__dirname, 'seed-data', DEMO_PROJECTS_FILE),
    join(__dirname, DEMO_PROJECTS_FILE),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  throw new Error(
    `Seed file "${DEMO_PROJECTS_FILE}" not found. Tried: ${candidates.join(', ')}`,
  );
}

const SEED_DIR_CANDIDATES = [
  join(process.cwd(), 'dist', 'apps', 'meriter', 'seed-data'),
  join(process.cwd(), 'apps', 'meriter', 'seed-data'),
  join(process.cwd(), 'seed-data'),
  join(__dirname, '..', '..', 'seed-data'),
  join(__dirname, 'seed-data'),
  join(__dirname),
] as const;

/** Directory containing seed-data TSV and dev-platform-snapshot.json (first existing candidate). */
export function resolveMeriterSeedDataDir(): string {
  for (const dir of SEED_DIR_CANDIDATES) {
    if (existsSync(join(dir, DEMO_PROJECTS_FILE))) {
      return dir;
    }
  }
  return SEED_DIR_CANDIDATES[0];
}
