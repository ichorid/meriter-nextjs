import {
  assertNoOverlapWithOpenRanges,
  buildMergedBlockPreviewContent,
  hashBlockOfficialAtPropose,
  isStaleVariant,
  mergeRangeIntoBlockHtml,
  normalizeRangeBounds,
} from '../src/domain/common/document-range.util';
import { blockHtmlToPlainText } from '../src/domain/common/document-plain-text.util';
import {
  mapStableBlockIds,
  parseDocumentHtmlToBlocks,
} from '../src/domain/common/document-html-structure.util';

describe('document-range.util', () => {
  const official = '<p>One two three four</p>';

  it('detects overlapping ranges', () => {
    expect(() =>
      assertNoOverlapWithOpenRanges(
        1,
        3,
        [{ rangeStart: 2, rangeEnd: 4, content: 'x' }],
        official,
      ),
    ).toThrow('RANGE_OVERLAP');
  });

  it('allows non-overlapping ranges', () => {
    expect(() =>
      assertNoOverlapWithOpenRanges(
        0,
        3,
        [{ rangeStart: 4, rangeEnd: 8, content: 'x' }],
        official,
      ),
    ).not.toThrow();
  });

  it('merges range into block html', () => {
    const merged = mergeRangeIntoBlockHtml(official, 0, 3, '<strong>NEW</strong>');
    expect(merged).toContain('NEW');
    expect(blockHtmlToPlainText(merged)).toContain('NEW');
  });

  it('stale hash changes when official changes', () => {
    const hash = hashBlockOfficialAtPropose(official);
    expect(isStaleVariant(hash, '<p>Changed</p>')).toBe(true);
    expect(isStaleVariant(hash, official)).toBe(false);
  });

  it('buildMergedBlockPreviewContent matches merge', () => {
    const preview = buildMergedBlockPreviewContent(official, 4, 7, 'X');
    expect(blockHtmlToPlainText(preview)).toMatch(/One.*X.*four/);
  });

  it('merges a plain-text deletion (empty proposed fragment)', () => {
    const withLine = '<p>Alpha</p><p>remove me</p><p>Omega</p>';
    const plain = blockHtmlToPlainText(withLine);
    const removeStart = plain.indexOf('remove me');
    const removeEnd = removeStart + 'remove me'.length;
    const merged = mergeRangeIntoBlockHtml(withLine, removeStart, removeEnd, '');
    expect(blockHtmlToPlainText(merged)).not.toContain('remove me');
    expect(blockHtmlToPlainText(merged)).toContain('Alpha');
    expect(blockHtmlToPlainText(merged)).toContain('Omega');
  });

  it('extends deletion start to word boundary so no orphan letter remains', () => {
    const official =
      '<p>Меритер — это среда. Тест прямой правки. Мир, где заслуга измерима.</p>';
    const plain = blockHtmlToPlainText(official);
    const start = plain.indexOf('ест');
    const end = plain.indexOf('правки') + 'правки'.length;
    const merged = mergeRangeIntoBlockHtml(official, start, end, '');
    const mergedPlain = blockHtmlToPlainText(merged);
    expect(mergedPlain).not.toContain('Тест');
    expect(mergedPlain).not.toContain('правки');
    expect(mergedPlain).toContain('Мир, где заслуга измерима');
  });

  it('allows zero-width range for plain-text insertion', () => {
    const plainLen = blockHtmlToPlainText(official).length;
    expect(normalizeRangeBounds(plainLen, plainLen, plainLen)).toEqual({
      rangeStart: plainLen,
      rangeEnd: plainLen,
    });
    const inserted = buildMergedBlockPreviewContent(
      official,
      plainLen,
      plainLen,
      '<p>New line</p>',
    );
    expect(blockHtmlToPlainText(inserted)).toContain('New line');
  });
});

describe('document-html-structure.util', () => {
  it('parses one li per list item', () => {
    const blocks = parseDocumentHtmlToBlocks(
      '<ul><li>First</li><li>Second</li></ul>',
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.blockType).toBe('list-bullet');
    expect(blocks[1]?.blockType).toBe('list-bullet');
  });

  it('preserves block id when content similar after cut-paste reorder', () => {
    const existing = [
      {
        id: 'block-a',
        order: 0,
        blockType: 'paragraph' as const,
        officialContent: '<p>Alpha</p>',
      },
      {
        id: 'block-b',
        order: 1,
        blockType: 'paragraph' as const,
        officialContent: '<p>Beta</p>',
      },
    ];
    const parsed = parseDocumentHtmlToBlocks('<p>Beta</p><p>Alpha</p>');
    const { blocks, report } = mapStableBlockIds(existing, parsed);
    expect(report.preserved).toContain('block-a');
    expect(report.preserved).toContain('block-b');
    expect(blocks.find((b) => b.id === 'block-b')?.order).toBe(0);
    expect(blocks.find((b) => b.id === 'block-a')?.order).toBe(1);
  });
});
