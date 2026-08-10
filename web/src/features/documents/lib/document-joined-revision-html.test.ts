import { buildJoinedDocumentRevisionHtml } from '@/features/documents/lib/document-joined-revision-html';
import {
  DOC_REVISION_DELETE_CLASS,
  DOC_REVISION_INSERT_CLASS,
} from '@/features/documents/lib/document-revision-styles';

describe('buildJoinedDocumentRevisionHtml', () => {
  it('highlights inserted blocks between existing headings', () => {
    const official = '<p>Intro</p><h2>Title</h2><h2>Footer</h2>';
    const variant =
      '<p>Intro</p><h2>Title</h2><p>Тест 3</p><h3>Подзаголовок 2</h3><p>Тест 4</p><h2>Footer</h2>';
    const html = buildJoinedDocumentRevisionHtml(official, variant);
    expect(html).toContain(DOC_REVISION_INSERT_CLASS);
    expect(html).toContain('Тест 3');
    expect(html).toContain('Подзаголовок 2');
    expect(html).toContain('Тест 4');
    expect(html?.match(new RegExp(DOC_REVISION_INSERT_CLASS, 'g'))?.length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('wraps consecutive list items in ul like clean preview', () => {
    const official =
      '<p>Intro</p><ul><li>One</li><li>Two</li><li>Three</li></ul>';
    const variant =
      '<p>Intro</p><ul><li>One</li><li>Two changed</li><li>Three</li></ul>';
    const html = buildJoinedDocumentRevisionHtml(official, variant)!;
    expect(html).toMatch(/<ul>[\s\S]*<li[^>]*>[\s\S]*Two changed[\s\S]*<\/li>[\s\S]*<\/ul>/);
    expect(html.match(/<ul>/g)?.length).toBe(1);
  });

  it('shows removed blocks as strikethrough between surviving paragraphs', () => {
    const official =
      '<p>Intro</p><p>Тест 1</p><p>Тест 2</p><p>Тест 3</p><p>Тест 4</p><h2>Footer</h2>';
    const variant = '<p>Intro</p><p>Тест 1</p><p>Тест 4</p><h2>Footer</h2>';
    const html = buildJoinedDocumentRevisionHtml(official, variant)!;
    expect(html).toContain(DOC_REVISION_DELETE_CLASS);
    expect(html).toContain('Тест 2');
    expect(html).toContain('Тест 3');
    expect(html).toContain('Тест 1');
    expect(html).toContain('Тест 4');
    expect(html).not.toContain('Тест 2</p><p>Тест 3');
  });

  it('returns null when official and variant match', () => {
    const html = '<p>Same</p>';
    expect(buildJoinedDocumentRevisionHtml(html, html)).toBeNull();
  });
});
