import {
  mergeRangeIntoLocked,
  normalizeLockedRanges,
  selectionLockedState,
  subtractRangeFromLocked,
} from '../src/domain/common/document-locked-ranges.util';

describe('document-locked-ranges.util', () => {
  it('merges overlapping locked ranges', () => {
    const merged = normalizeLockedRanges(20, [
      { rangeStart: 2, rangeEnd: 5 },
      { rangeStart: 4, rangeEnd: 8 },
    ]);
    expect(merged).toEqual([{ rangeStart: 2, rangeEnd: 8 }]);
  });

  it('detects selection lock state', () => {
    const ranges = [{ rangeStart: 0, rangeEnd: 5 }];
    expect(selectionLockedState(ranges, 1, 4)).toBe('all');
    expect(selectionLockedState(ranges, 6, 10)).toBe('none');
    expect(selectionLockedState(ranges, 3, 8)).toBe('mixed');
  });

  it('merges and subtracts ranges', () => {
    let ranges = mergeRangeIntoLocked([], 2, 6, 20);
    expect(ranges).toEqual([{ rangeStart: 2, rangeEnd: 6 }]);
    ranges = subtractRangeFromLocked(ranges, 3, 5, 20);
    expect(ranges).toEqual([
      { rangeStart: 2, rangeEnd: 3 },
      { rangeStart: 5, rangeEnd: 6 },
    ]);
  });
});
