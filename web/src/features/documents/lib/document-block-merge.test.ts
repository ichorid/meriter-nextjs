import { mergeRangeIntoBlockHtmlWithRevisionMarks } from '@/features/documents/lib/document-block-merge';
import { DOC_REVISION_DELETE_CLASS } from '@/features/documents/lib/document-revision-styles';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';

describe('mergeRangeIntoBlockHtmlWithRevisionMarks', () => {
  it('shows <del> inside a single <p> block (unified editor body)', () => {
    const official =
      '<p>Меритер — это среда. Тест прямой правки. Мир, где заслуга измерима.</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('Тест');
    const end = plain.indexOf('правки') + 'правки'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(official, start, end, '');
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">`);
    expect(html).toContain('Тест прямой правки');
    expect(html).not.toMatch(/<p>[^<]*Мир[^<]*<\/p>/);
    expect(html).toContain('Мир, где заслуга измерима');
  });

  it('wraps deleted phrase in <del> while keeping surrounding paragraphs', () => {
    const official =
      '<p>Before.</p><p>Тест прямой правки</p><p><strong>After</strong></p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('Тест');
    const end = plain.indexOf('правки') + 'правки'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(official, start, end, '');
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">`);
    expect(html).toContain('Тест прямой правки');
    expect(html).toContain('After');
    expect(html).toMatch(/<\/del>/);
  });

  it('shows both <del> and <ins> for in-place replacement', () => {
    const official = '<p>Keep this original tail</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('original');
    const end = start + 'original'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(
      official,
      start,
      end,
      'replacement',
    );
    expect(html).toMatch(
      new RegExp(
        `<del class="${DOC_REVISION_DELETE_CLASS}">original</del><ins class="doc-revision-ins">replacement</ins>`,
      ),
    );
    expect(html).toContain('Keep this');
    expect(html).toContain(' tail');
  });

  it('marks only the edited phrase inside one paragraph of a multi-paragraph block', () => {
    const official =
      '<p>First paragraph stays intact.</p><p>Middle with Тест прямой правки inside.</p><p>Last paragraph untouched.</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('Тест');
    const end = plain.indexOf('правки') + 'правки'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(official, start, end, '');
    expect(html).toContain('<p>First paragraph stays intact.</p>');
    expect(html).toContain('<p>Last paragraph untouched.</p>');
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">`);
    expect(html).toContain('Тест прямой правки');
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*First paragraph[\s\S]*<\/del>/);
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*Last paragraph[\s\S]*<\/del>/);
  });

  it('keeps a single paragraph wrapper when highlighting an in-paragraph edit', () => {
    const official =
      '<p>Line one with context. Тест прямой правки. Line two continues.</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('Тест');
    const end = plain.indexOf('правки') + 'правки'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(official, start, end, '');
    expect(html.match(/<p\b/g)?.length).toBe(1);
    expect(html).toContain('Line one with context.');
    expect(html).toContain('Line two continues.');
  });
});
