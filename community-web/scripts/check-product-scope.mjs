import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Product terms that must not appear in community-web (no Birzha / investments / full Meriter hubs). */
const FORBIDDEN_PATTERNS = [
  { name: 'main-app path', re: /meriter\.pro\/meriter/i },
  {
    name: 'out-of-scope product surface',
    re: /\b(birzha|marathon-of-good|tappalka|publishToBirzha|future-visions|investingEnabled|investInProject)\b/i,
  },
];

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
    if (!/\.(tsx?|jsx?|md|json|env\.example|mjs)$/.test(entry)) continue;
    if (entry === 'check-no-main-app-links.mjs' || entry === 'check-product-scope.mjs') {
      continue;
    }
    const text = readFileSync(full, 'utf8');
    for (const { name, re } of FORBIDDEN_PATTERNS) {
      if (re.test(text) && !ALLOWED_EXCEPTION.test(text)) {
        console.error(`Product scope violation (${name}): ${full}`);
        failures += 1;
        break;
      }
    }
  }
}

if (!existsSync(ROOT)) {
  console.error('community-web root not found');
  process.exit(1);
}

walk(join(ROOT, 'src'));
walk(join(ROOT, 'scripts'));

console.log(
  failures === 0
    ? 'OK: community-web product scope clean (no Birzha/invest/main-app links)'
    : `FAILED: ${failures} file(s)`,
);
process.exit(failures === 0 ? 0 : 1);
