import { existsSync } from 'fs';
import { join } from 'path';

const FILE = 'future-visions-marketing.tsv';

/**
 * Resolve UTF-8 marketing TSV (repo layout, dist copy, or cwd variants).
 */
export function resolveFutureVisionsMarketingTsvPath(): string {
  const candidates = [
    join(process.cwd(), 'apps', 'meriter', 'seed-data', FILE),
    join(process.cwd(), 'seed-data', FILE),
    join(__dirname, '..', '..', 'seed-data', FILE),
    join(__dirname, 'seed-data', FILE),
    /** Nest/webpack copies TSV next to meriter bundle output */
    join(__dirname, FILE),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  throw new Error(
    `Seed file "${FILE}" not found. Tried: ${candidates.join(', ')}`,
  );
}
