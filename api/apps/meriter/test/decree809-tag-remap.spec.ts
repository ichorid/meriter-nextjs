import { DECREE_809_TAGS, remapDecree809ValueTags } from '@meriter/shared-types';

describe('remapDecree809ValueTags', () => {
  it('normalizes casing of canonical decree tags', () => {
    const out = remapDecree809ValueTags(['жизнь', '  Патриотизм ']);
    expect(out).toEqual(['Жизнь', 'Патриотизм']);
  });

  it('expands known legacy combined labels', () => {
    const out = remapDecree809ValueTags(['Гражданственность и ответственность']);
    expect(out).toEqual(['Гражданственность', 'Служение Отечеству и ответственность за его судьбу']);
  });

  it('maps obsolete standalone labels to canonical', () => {
    const out = remapDecree809ValueTags(['Здоровый образ жизни']);
    expect(out).toEqual(['Жизнь']);
  });

  it('preserves unknown tags (admin extras)', () => {
    const out = remapDecree809ValueTags(['Кастомный тег платформы']);
    expect(out).toEqual(['Кастомный тег платформы']);
  });

  it('dedupes after remap', () => {
    const out = remapDecree809ValueTags(['Жизнь', 'жизнь']);
    expect(out).toEqual(['Жизнь']);
  });

  it('canonical list length is 17', () => {
    expect(DECREE_809_TAGS).toHaveLength(17);
  });
});
