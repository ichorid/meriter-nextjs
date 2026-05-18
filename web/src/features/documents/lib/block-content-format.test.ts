import {
  convertBlockContent,
  normalizeOfficialContentForDisplay,
  parseHeadingContent,
  parseListItems,
  serializeHeadingContent,
  serializeListItems,
} from './block-content-format';

describe('block-content-format', () => {
  it('serializes and parses heading', () => {
    const html = serializeHeadingContent(2, 'Future vision');
    expect(parseHeadingContent(html)).toEqual({ level: 2, text: 'Future vision' });
  });

  it('serializes and parses bullet list', () => {
    const html = serializeListItems(['One', 'Two'], false);
    expect(parseListItems(html, false)).toEqual(['One', 'Two']);
  });

  it('converts paragraph to bullet list', () => {
    const html = convertBlockContent('<p>Line one</p><p>Line two</p>', 'paragraph', 'list-bullet');
    expect(parseListItems(html, false)).toEqual(['Line one', 'Line two']);
  });

  it('converts heading to paragraph', () => {
    const html = convertBlockContent('<h2>Title</h2>', 'heading', 'paragraph');
    expect(html).toBe('<p>Title</p>');
  });

  it('normalizes plain heading text for display', () => {
    const html = normalizeOfficialContentForDisplay('heading', 'Подзаголовок H2');
    expect(html).toBe('<h2>Подзаголовок H2</h2>');
  });

  it('normalizes multi-paragraph body as bullet list for display', () => {
    const html = normalizeOfficialContentForDisplay(
      'list-bullet',
      '<p>One</p><p>Two</p>',
    );
    expect(parseListItems(html, false)).toEqual(['One', 'Two']);
  });
});
