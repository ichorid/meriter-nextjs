/**
 * Decree 809 value tags — canonical rubricator block (17 items).
 * Keep in sync with platform seed / Mongo `decree809Tags` default.
 */
export const DECREE_809_TAGS: readonly string[] = [
  "Взаимопомощь и взаимоуважение",
  "Высокие нравственные идеалы",
  "Гражданственность и ответственность",
  "Творчество и самореализация",
  "Здоровый образ жизни",
  "Семейные ценности и традиции",
  "Труд и предпринимательство",
  "Духовно-нравственное развитие личности",
  "Патриотизм и гражданский долг",
  "Уважение к старшим и забота о подрастающем поколении",
  "Экологическая ответственность",
  "Мир, согласие и межнациональное единство",
  "Справедливость и социальная солидарность",
  "Толерантность и уважение к многообразию",
  "Наука, образование и просвещение",
  "Культура и искусство",
  "Спорт и физическая активность",
];

export const VALUE_TAG_MAX_LENGTH = 120;
export const VALUE_TAGS_MAX_PER_POST = 20;

export interface PlatformValueRubricatorInput {
  decree809Enabled?: boolean;
  /** Persisted copy of decree list; if empty, use DECREE_809_TAGS. */
  decree809Tags?: string[];
  availableFutureVisionTags?: string[];
}

/**
 * (а) Decree 809 block when enabled; (б) admin extras without duplicating decree (case-insensitive).
 */
export function buildEffectiveRubricatorSections(
  settings: PlatformValueRubricatorInput
): { decree809: string[]; adminExtras: string[] } {
  const decreeSource =
    settings.decree809Tags && settings.decree809Tags.length > 0
      ? settings.decree809Tags
      : [...DECREE_809_TAGS];
  const decree809 = settings.decree809Enabled ? decreeSource : [];
  const exclude = new Set(
    decree809.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const adminExtras = (settings.availableFutureVisionTags ?? []).filter(
    (t) => {
      const k = t.trim().toLowerCase();
      return k.length > 0 && !exclude.has(k);
    }
  );
  return { decree809, adminExtras };
}

export function buildEffectiveRubricatorFlat(
  settings: PlatformValueRubricatorInput
): string[] {
  const { decree809, adminExtras } = buildEffectiveRubricatorSections(settings);
  return [...decree809, ...adminExtras];
}
