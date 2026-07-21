import { mergeRangeIntoBlockHtmlWithRevisionMarks } from '@/features/documents/lib/document-block-merge';
import { buildJoinedDocumentRevisionHtml } from '@/features/documents/lib/document-joined-revision-html';
import {
  DOC_REVISION_DELETE_CLASS,
  DOC_REVISION_INSERT_CLASS,
} from '@/features/documents/lib/document-revision-styles';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import { buildWordLevelRevisionReplacementHtml } from '@/features/documents/lib/document-word-revision-markup';

describe('buildWordLevelRevisionReplacementHtml', () => {
  it('marks only the changed word inside a sentence', () => {
    const html = buildWordLevelRevisionReplacementHtml('quick brown fox', 'quick red fox');
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">brown</del>`);
    expect(html).toContain(`<ins class="${DOC_REVISION_INSERT_CLASS}">red</ins>`);
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*quick[\s\S]*<\/del>/);
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*fox[\s\S]*<\/del>/);
  });
});

describe('mergeRangeIntoBlockHtmlWithRevisionMarks word diff', () => {
  it('highlights only one replaced word in a paragraph', () => {
    const official = '<p>The quick brown fox jumps over the lazy dog.</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('brown');
    const end = start + 'brown'.length;
    const html = mergeRangeIntoBlockHtmlWithRevisionMarks(official, start, end, 'red');
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">brown</del>`);
    expect(html).toContain(`<ins class="${DOC_REVISION_INSERT_CLASS}">red</ins>`);
    expect(html).toContain('The quick');
    expect(html).toContain('fox jumps');
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*The quick[\s\S]*<\/del>/);
  });
});

describe('buildJoinedDocumentRevisionHtml word diff', () => {
  it('does not strike through an entire paragraph when one word changes', () => {
    const official =
      '<p>First paragraph untouched.</p><p>The quick brown fox.</p><p>Last paragraph untouched.</p>';
    const variant =
      '<p>First paragraph untouched.</p><p>The quick red fox.</p><p>Last paragraph untouched.</p>';
    const html = buildJoinedDocumentRevisionHtml(official, variant)!;
    expect(html).toContain(`<del class="${DOC_REVISION_DELETE_CLASS}">brown</del>`);
    expect(html).toContain(`<ins class="${DOC_REVISION_INSERT_CLASS}">red</ins>`);
    expect(html).toContain('First paragraph untouched.');
    expect(html).toContain('Last paragraph untouched.');
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*First paragraph[\s\S]*<\/del>/);
    expect(html).not.toMatch(/<del[^>]*>[\s\S]*The quick brown fox[\s\S]*<\/del>/);
  });
});
