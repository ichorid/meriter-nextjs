import { DECREE_809_TAGS } from '@meriter/shared-types';

const D = DECREE_809_TAGS;

/**
 * Maps comma-separated labels from the marketing sheet to canonical Decree 809 tags.
 * Unknown fragments are skipped; at least one tag is always returned.
 */
export function mapDemoProjectValuesToDecree809(raw: string): string[] {
  const parts = raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const out: string[] = [];
  for (const p of parts) {
    const mapped = mapOnePhrase(p);
    if (mapped && !out.includes(mapped)) {
      out.push(mapped);
    }
    if (out.length >= 3) {
      break;
    }
  }

  if (out.length === 0) {
    return [D[6], D[11]];
  }
  return out;
}

/** Longest keys first for multi-word phrases */
const PHRASE_TO_DECREE: readonly { key: string; tag: string }[] = [
  { key: 'ответственность за судьбу отечества', tag: D[5] },
  { key: 'единство народов россии', tag: D[16] },
  { key: 'высокие нравственные идеалы', tag: D[6] },
  { key: 'развитие личности', tag: D[6] },
  { key: 'созидательный труд', tag: D[8] },
  { key: 'служение отечеству', tag: D[5] },
  { key: 'историческая память', tag: D[15] },
  { key: 'крепкая семья', tag: D[7] },
  { key: 'взаимоуважение', tag: D[14] },
  { key: 'взаимопомощь', tag: D[14] },
  { key: 'гражданственность', tag: D[4] },
  { key: 'патриотизм', tag: D[3] },
  { key: 'милосердие', tag: D[11] },
  { key: 'гуманизм', tag: D[10] },
  { key: 'справедливость', tag: D[12] },
  { key: 'достоинство', tag: D[1] },
  { key: 'коллективизм', tag: D[13] },
  { key: 'ответственность', tag: D[5] },
  { key: 'экологическ', tag: D[0] },
  { key: 'жизнь', tag: D[0] },
  { key: 'здоров', tag: D[0] },
  { key: 'спорт', tag: D[0] },
  { key: 'культур', tag: D[9] },
  { key: 'образован', tag: D[0] },
  { key: 'творчеств', tag: D[9] },
  { key: 'наука', tag: D[0] },
];

function normalizePhrase(p: string): string {
  return p
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapOnePhrase(phrase: string): string | null {
  const n = normalizePhrase(phrase);
  if (!n) {
    return null;
  }

  for (const { key, tag } of PHRASE_TO_DECREE) {
    if (n.includes(key)) {
      return tag;
    }
  }

  return null;
}
