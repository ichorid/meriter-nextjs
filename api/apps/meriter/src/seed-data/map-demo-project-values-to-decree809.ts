import { DECREE_809_TAGS } from '@meriter/shared-types';

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
    return [DECREE_809_TAGS[6], DECREE_809_TAGS[11]];
  }
  return out;
}

/** Longest keys first for multi-word phrases */
const PHRASE_TO_DECREE: readonly { key: string; tag: string }[] = [
  { key: 'ответственность за судьбу отечества', tag: 'Патриотизм и гражданский долг' },
  { key: 'единство народов россии', tag: 'Мир, согласие и межнациональное единство' },
  { key: 'высокие нравственные идеалы', tag: 'Высокие нравственные идеалы' },
  { key: 'развитие личности', tag: 'Духовно-нравственное развитие личности' },
  { key: 'созидательный труд', tag: 'Труд и предпринимательство' },
  { key: 'служение отечеству', tag: 'Патриотизм и гражданский долг' },
  { key: 'историческая память', tag: 'Высокие нравственные идеалы' },
  { key: 'крепкая семья', tag: 'Семейные ценности и традиции' },
  { key: 'взаимоуважение', tag: 'Взаимопомощь и взаимоуважение' },
  { key: 'взаимопомощь', tag: 'Взаимопомощь и взаимоуважение' },
  { key: 'гражданственность', tag: 'Гражданственность и ответственность' },
  { key: 'патриотизм', tag: 'Патриотизм и гражданский долг' },
  { key: 'милосердие', tag: 'Справедливость и социальная солидарность' },
  { key: 'гуманизм', tag: 'Справедливость и социальная солидарность' },
  { key: 'справедливость', tag: 'Справедливость и социальная солидарность' },
  { key: 'достоинство', tag: 'Справедливость и социальная солидарность' },
  { key: 'коллективизм', tag: 'Взаимопомощь и взаимоуважение' },
  { key: 'ответственность', tag: 'Гражданственность и ответственность' },
  { key: 'экологическ', tag: 'Экологическая ответственность' },
  { key: 'жизнь', tag: 'Духовно-нравственное развитие личности' },
  { key: 'здоров', tag: 'Здоровый образ жизни' },
  { key: 'спорт', tag: 'Спорт и физическая активность' },
  { key: 'культур', tag: 'Культура и искусство' },
  { key: 'образован', tag: 'Наука, образование и просвещение' },
  { key: 'творчеств', tag: 'Творчество и самореализация' },
  { key: 'наука', tag: 'Наука, образование и просвещение' },
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
