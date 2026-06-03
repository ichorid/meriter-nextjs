import {
  buildBlockPlainSegments,
  editChangeOverlapsLocked,
  findPlainTextChangeBounds,
  isAppendNewBlocksAtEnd,
  mapGlobalPlainRangeToBlock,
  proposedEditOverlapsLocked,
} from '../src/domain/common/document-block-structure.util';
import { blockHtmlToPlainText } from '../src/domain/common/document-plain-text.util';

describe('document-block-structure.util', () => {
  it('maps global plain range to owning block', () => {
    const blocks = [
      { id: 'a', officialContent: '<p>Hello</p>' },
      { id: 'b', officialContent: '<p>World</p>' },
    ];
    const { segments, joinedPlain } = buildBlockPlainSegments(blocks);
    const helloLen = blockHtmlToPlainText(blocks[0]!.officialContent).length;
    expect(joinedPlain).toBe(`${blockHtmlToPlainText('<p>Hello</p>')}${blockHtmlToPlainText('<p>World</p>')}`);

    expect(mapGlobalPlainRangeToBlock(segments, 0, 2)).toEqual({
      blockId: 'a',
      localStart: 0,
      localEnd: 2,
    });
    expect(mapGlobalPlainRangeToBlock(segments, helloLen, helloLen)).toEqual({
      blockId: 'a',
      localStart: helloLen,
      localEnd: helloLen,
    });
    expect(mapGlobalPlainRangeToBlock(segments, joinedPlain.length, joinedPlain.length)).toEqual({
      blockId: 'b',
      localStart: blockHtmlToPlainText('<p>World</p>').length,
      localEnd: blockHtmlToPlainText('<p>World</p>').length,
    });
  });

  it('detects append of new paragraph blocks at document end', () => {
    const prev = '<p>Pinned paragraph.</p>';
    const next = '<p>Pinned paragraph.</p><p>Test suggestion</p>';
    const appended = isAppendNewBlocksAtEnd(prev, next);
    expect(appended).toHaveLength(1);
    expect(appended![0]!.officialContent).toContain('Test suggestion');
  });

  it('does not flag end insert as overlapping prior locked prefix', () => {
    const official = 'Pinned paragraph.';
    const variant = `${official}\nTest suggestion`;
    const locked = [{ rangeStart: 0, rangeEnd: 8 }];
    const bounds = findPlainTextChangeBounds(official, variant);
    expect(bounds).not.toBeNull();
    expect(
      proposedEditOverlapsLocked(bounds!.rangeStart, bounds!.rangeEnd, locked),
    ).toBe(false);
    expect(editChangeOverlapsLocked(official, variant, locked)).toBe(false);
  });
});
