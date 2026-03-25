/**
 * Currency formatting utilities
 */

export interface CurrencyNames {
  singular: string;
  plural: string;
  genitive: string;
}

export function formatCurrencyAmount(amount: number, currency: CurrencyNames): string {
  const { singular, plural, genitive } = currency;
  
  // Handle Russian plurals
  const lastDigit = amount % 10;
  const lastTwoDigits = amount % 100;
  
  let form: string;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    form = genitive;
  } else if (lastDigit === 1) {
    form = singular;
  } else if (lastDigit >= 2 && lastDigit <= 4) {
    form = genitive;
  } else {
    form = genitive;
  }
  
  return `${amount} ${form}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** Round merit amounts for display or persistence (max one decimal place). */
export function roundMeritsToDisplay(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Format merits to at most 1 decimal place (avoids float artifacts like 56.63000000000001).
 * Examples: 10.7 → "10.7", 10 → "10", 0.5 → "0.5"
 */
export function formatMerits(value: number): string {
  const rounded = roundMeritsToDisplay(value);
  const s = rounded.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}