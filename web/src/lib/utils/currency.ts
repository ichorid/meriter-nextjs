/**
 * Currency formatting utilities
 */

export interface CurrencyNames {
  singular: string;
  plural: string;
  genitive: string;
}

export function formatCurrencyAmount(amount: number, currency: CurrencyNames): string {
  const { singular, _plural, genitive } = currency;
  
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