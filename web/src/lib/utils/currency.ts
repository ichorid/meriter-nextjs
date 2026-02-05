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

/**
 * Format merits to 1 decimal place
 * Examples: 10.7, 10.0 -> 10, 0.5 -> 0.5
 */
export function formatMerits(value: number): string {
  // Round to 1 decimal place
  const rounded = Math.round(value * 10) / 10;
  // Format to 1 decimal place, but remove trailing zeros
  return rounded.toFixed(1).replace(/\.0$/, '');
}