import { describe, expect, it } from 'vitest';
import { futureVisionMirrorPlainTextToHtml } from './future-vision-mirror-text';

describe('futureVisionMirrorPlainTextToHtml', () => {
  it('renders section titles from mirror plain text', () => {
    const html = futureVisionMirrorPlainTextToHtml(
      '# Основная мысль\n\nКстати, вот она.\n\nИ второй абзац.',
    );
    expect(html).toContain('<h2>Основная мысль</h2>');
    expect(html).toContain('Кстати, вот она.');
    expect(html).not.toContain('# Основная');
  });
});
