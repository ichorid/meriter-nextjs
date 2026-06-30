/** Letter or digit (incl. Cyrillic) — used to detect mid-word deletion boundaries. */
const WORD_CHAR = /[\p{L}\p{N}]/u;

export function isPlainWordChar(char: string): boolean {
  return char.length > 0 && WORD_CHAR.test(char);
}

/**
 * When a deletion range starts inside a word, extend rangeStart to the word start
 * so the whole word is removed in the proposal (matches web `expandDeletionRangeStart`).
 */
export function expandDeletionRangeStart(plain: string, rangeStart: number): number {
  let start = Math.max(0, Math.floor(rangeStart));
  if (start >= plain.length) {
    return start;
  }
  while (start > 0 && isPlainWordChar(plain[start - 1]!) && isPlainWordChar(plain[start]!)) {
    start--;
  }
  return start;
}
