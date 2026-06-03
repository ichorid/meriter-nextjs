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
});
