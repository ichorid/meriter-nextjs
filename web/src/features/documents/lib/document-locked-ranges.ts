import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';

export type LockedRange = { rangeStart: number; rangeEnd: number };

export function normalizeRangeBounds(
  plainLength: number,
  start: number,
  end: number,
): LockedRange | null {
  const rangeStart = Math.max(0, Math.floor(start));
  const rangeEnd = Math.min(plainLength, Math.floor(end));
  if (rangeEnd <= rangeStart) {
    return null;
  }
  return { rangeStart, rangeEnd };
}

export function mergeLockedRanges(ranges: LockedRange[]): LockedRange[] {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.rangeStart - b.rangeStart);
  const out: LockedRange[] = [{ ...sorted[0]! }];
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

export function normalizeLockedRanges(
  plainLength: number,
  ranges: LockedRange[] | undefined,
): LockedRange[] {
  if (!ranges?.length || plainLength <= 0) {
    return [];
  }
  const normalized: LockedRange[] = [];
  for (const r of ranges) {
    const b = normalizeRangeBounds(plainLength, r.rangeStart, r.rangeEnd);
    if (b) {
      normalized.push(b);
    }
  }
  return mergeLockedRanges(normalized);
}

export function mergeRangeIntoLocked(
  ranges: LockedRange[],
  start: number,
  end: number,
  plainLength: number,
): LockedRange[] {
  const bounds = normalizeRangeBounds(plainLength, start, end);
  if (!bounds) {
    return ranges;
  }
  return mergeLockedRanges([...ranges, bounds]);
}

export function subtractRangeFromLocked(
  ranges: LockedRange[],
  start: number,
  end: number,
  plainLength: number,
): LockedRange[] {
  const bounds = normalizeRangeBounds(plainLength, start, end);
  if (!bounds) {
    return ranges;
  }
  const out: LockedRange[] = [];
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
  ranges: LockedRange[],
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
  html: string,
  proposalsLocked: boolean,
  lockedRanges: LockedRange[] | undefined,
): LockedRange[] {
  const plainLength = blockHtmlToPlainText(html).length;
  const stored = normalizeLockedRanges(plainLength, lockedRanges);
  if (stored.length > 0) {
    return stored;
  }
  if (proposalsLocked && plainLength > 0) {
    return [{ rangeStart: 0, rangeEnd: plainLength }];
  }
  return [];
}

/** Ranges to mutate when admin edits pins (includes legacy proposalsLocked-only blocks). */
export function getEditableLockedRanges(
  html: string,
  proposalsLocked: boolean,
  lockedRanges: LockedRange[] | undefined,
): LockedRange[] {
  return getEffectiveLockedRanges(html, proposalsLocked, lockedRanges);
}

export type PinToolbarAction = 'lock' | 'unlock';

export function pinActionForSelection(
  ranges: LockedRange[],
  selStart: number,
  selEnd: number,
): PinToolbarAction | null {
  const state = selectionLockedState(ranges, selStart, selEnd);
  if (state === 'none') {
    return 'lock';
  }
  if (state === 'all') {
    return 'unlock';
  }
  return 'lock';
}

export function applyPinActionToRanges(
  ranges: LockedRange[],
  action: PinToolbarAction,
  selStart: number,
  selEnd: number,
  plainLength: number,
): LockedRange[] {
  if (action === 'lock') {
    return mergeRangeIntoLocked(ranges, selStart, selEnd, plainLength);
  }
  return subtractRangeFromLocked(ranges, selStart, selEnd, plainLength);
}
