import { parseFutureVisionMirrorToInitialSections } from '../src/domain/common/parse-future-vision-mirror';

describe('parseFutureVisionMirrorToInitialSections', () => {
  it('splits mirror text into titled sections with paragraph blocks', () => {
    const sections = parseFutureVisionMirrorToInitialSections(
      '# Главный заголовок\n\nПервый абзац.\n\n# Второй раздел\n\nВторой абзац.',
    );
    expect(sections).toHaveLength(2);
    expect(sections?.[0]?.title).toBe('Главный заголовок');
    expect(sections?.[0]?.blocks).toHaveLength(1);
    expect(sections?.[0]?.blocks[0]?.officialContent).toContain('Первый абзац.');
    expect(sections?.[1]?.title).toBe('Второй раздел');
  });
});
