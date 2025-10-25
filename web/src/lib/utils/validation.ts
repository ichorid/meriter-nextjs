/**
 * Form validation helpers
 */

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function required(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return 'This field is required';
  }
  return null;
}

export function minLength(min: number) {
  return (value: string): string | null => {
    if (!value || value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  };
}

export function maxLength(max: number) {
  return (value: string): string | null => {
    if (!value || value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  };
}
