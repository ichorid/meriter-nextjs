import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FORBIDDEN = /meriter\.pro\/meriter/i;
const ALLOWED_EXCEPTION = /community\.meriter\.pro/i;

let failures = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx?|jsx?|md|json|env\.example)$/.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    if (FORBIDDEN.test(text) && !ALLOWED_EXCEPTION.test(text)) {
      console.error(`Isolation violation: ${full}`);
      failures += 1;
    }
  }
}

if (!existsSync(ROOT)) {
  console.error('community-web root not found');
  process.exit(1);
}

walk(join(ROOT, 'src'));
console.log(failures === 0 ? 'OK: no cross-links to meriter.pro/meriter' : `FAILED: ${failures} file(s)`);
process.exit(failures === 0 ? 0 : 1);
