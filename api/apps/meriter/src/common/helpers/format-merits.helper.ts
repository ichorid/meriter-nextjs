/**
 * Format merit amounts for display (notifications, logs).
 * Rounds to one decimal place; platform-wide standard for merit counters.
 */
export function formatMeritsForDisplay(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const s = rounded.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
