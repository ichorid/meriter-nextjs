import { DECREE_809_TAGS } from './value-rubricator';

/**
 * Bump when canonical `DECREE_809_TAGS` changes or legacy mappings are extended.
 * API runs a one-time migration when stored revision is below this value.
 */
export const DECREE_809_TAGS_REVISION = 1;

export function normalizeDecreeTagKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const D = [...DECREE_809_TAGS] as string[];

const CANONICAL_BY_LOWER = new Map<string, string>(
  D.map((c) => [normalizeDecreeTagKey(c), c]),
);

/**
 * Normalized legacy labels (wrong early deploy / pre-canonical list) → canonical tags.
 * Keys must be `normalizeDecreeTagKey` output.
 */
const LEGACY_TO_CANONICAL: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['гражданственность и ответственность', [D[4], D[5]]],
  ['творчество и самореализация', [D[8], D[9]]],
  ['здоровый образ жизни', [D[0]]],
  ['семейные ценности', [D[7]]],
  ['семейные ценности и', [D[7]]],
  ['семейные ценности и воспитание детей', [D[7]]],
  ['ответственность за судьбу отечества', [D[5]]],
  ['права человека', [D[2]]],
  ['свободы человека', [D[2]]],
];

const LEGACY_MAP = new Map<string, readonly string[]>(
  LEGACY_TO_CANONICAL.map(([k, v]) => [k, v]),
);

/**
 * Remap stored value tags: normalize casing for canonical decree tags, replace known
 * legacy phrases with the official 809 list. Unknown strings are kept (admin extras, etc.).
 */
export function remapDecree809ValueTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (x: string) => {
    if (seen.has(x)) return;
    seen.add(x);
    out.push(x);
  };

  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;

    const norm = normalizeDecreeTagKey(t);
    const canon = CANONICAL_BY_LOWER.get(norm);
    if (canon) {
      push(canon);
      continue;
    }

    const expanded = LEGACY_MAP.get(norm);
    if (expanded) {
      for (const c of expanded) {
        push(c);
      }
      continue;
    }

    push(t);
  }
  return out;
}
