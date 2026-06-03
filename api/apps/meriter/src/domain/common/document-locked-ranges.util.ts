import type { DocumentRangeBounds } from './document-range.util';
import { normalizeRangeBounds } from './document-range.util';
import { rangesOverlap } from './document-plain-text.util';

export type LockedRangeInput = { rangeStart: number; rangeEnd: number };

export function normalizeLockedRanges(
  plainLength: number,
  ranges: LockedRangeInput[] | undefined,
): DocumentRangeBounds[] {
  if (!ranges?.length || plainLength <= 0) {
    return [];
  }
  const normalized: DocumentRangeBounds[] = [];
  for (const r of ranges) {
    try {
      normalized.push(normalizeRangeBounds(plainLength, r.rangeStart, r.rangeEnd));
    } catch {
      // skip invalid
    }
  }
  return mergeLockedRanges(normalized);
}

export function mergeLockedRanges(ranges: DocumentRangeBounds[]): DocumentRangeBounds[] {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.rangeStart - b.rangeStart);
  const out: DocumentRangeBounds[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.rangeStart <= last.rangeEnd) {
      last.rangeEnd = Math.max(last.rangeEnd, cur.rangeEnd);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function mergeRangeIntoLocked(
  ranges: DocumentRangeBounds[],
  start: number,
  end: number,
  plainLength: number,
): DocumentRangeBounds[] {
  const bounds = normalizeRangeBounds(plainLength, start, end);
  return mergeLockedRanges([...ranges, bounds]);
}

export function subtractRangeFromLocked(
  ranges: DocumentRangeBounds[],
  start: number,
  end: number,
  plainLength: number,
): DocumentRangeBounds[] {
  const bounds = normalizeRangeBounds(plainLength, start, end);
  const out: DocumentRangeBounds[] = [];
  for (const r of ranges) {
    if (bounds.rangeEnd <= r.rangeStart || bounds.rangeStart >= r.rangeEnd) {
      out.push({ ...r });
      continue;
    }
    if (bounds.rangeStart > r.rangeStart) {
      out.push({ rangeStart: r.rangeStart, rangeEnd: bounds.rangeStart });
    }
    if (bounds.rangeEnd < r.rangeEnd) {
      out.push({ rangeStart: bounds.rangeEnd, rangeEnd: r.rangeEnd });
    }
  }
  return mergeLockedRanges(out);
}

export type SelectionLockedState = 'none' | 'all' | 'mixed';

export function selectionLockedState(
  ranges: DocumentRangeBounds[],
  selStart: number,
  selEnd: number,
): SelectionLockedState {
  const len = selEnd - selStart;
  if (len <= 0) {
    return 'none';
  }
  let locked = 0;
  for (const r of ranges) {
    const oStart = Math.max(r.rangeStart, selStart);
    const oEnd = Math.min(r.rangeEnd, selEnd);
    if (oEnd > oStart) {
      locked += oEnd - oStart;
    }
  }
  if (locked <= 0) {
    return 'none';
  }
  if (locked >= len) {
    return 'all';
  }
  return 'mixed';
}

export function getEffectiveLockedRanges(
  plainLength: number,
  proposalsLocked: boolean | undefined,
  lockedRanges: LockedRangeInput[] | undefined,
): DocumentRangeBounds[] {
  if (proposalsLocked === true && plainLength > 0) {
    return [{ rangeStart: 0, rangeEnd: plainLength }];
  }
  return normalizeLockedRanges(plainLength, lockedRanges);
}

export function assertRangeNotOverlappingLocked(
  start: number,
  end: number,
  locked: DocumentRangeBounds[],
): void {
  for (const r of locked) {
    if (rangesOverlap(start, end, r.rangeStart, r.rangeEnd)) {
      throw new Error('RANGE_LOCKED');
    }
  }
}

export function plainTextEditOverlapsLocked(
  oldPlain: string,
  newPlain: string,
  locked: DocumentRangeBounds[],
): boolean {
  const max = Math.max(oldPlain.length, newPlain.length);
  for (let i = 0; i < max; i++) {
    const a = oldPlain[i] ?? '';
    const b = newPlain[i] ?? '';
    if (a === b) {
      continue;
    }
    for (const r of locked) {
      if (i >= r.rangeStart && i < r.rangeEnd) {
        return true;
      }
    }
  }
  return false;
}
