/**
 * Merit amount rounding and display formatting (BC-02 / inv-26).
 * Platform-wide standard: at most one decimal place for counters and notifications.
 */

/** Round merit amounts for display (max one decimal place). Non-finite → 0. */
export function roundMeritsToDisplay(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Format merit amounts for display (notifications, logs).
 * Examples: 10.7 → "10.7", 10 → "10", 0.5 → "0.5"
 */
export function formatMeritsForDisplay(value: number): string {
  const rounded = roundMeritsToDisplay(value);
  const s = rounded.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
