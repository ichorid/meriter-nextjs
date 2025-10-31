/**
 * Text formatting and manipulation utilities
 */

export const textToHTML = (text: string) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/\n/g, '<br>')
    return newText
}
export const textToTelegramHTML = (text: string) => {
    let newText = text
    newText = newText.replace(/  +/g, ' ')
    newText = newText.replace(/ \n+/g, '\n')
    return newText
}

export const ellipsize = (text: string, maxLength: number = 40): string => {
    if (!text) return '';
    // Remove newlines and extra spaces
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
}

/**
 * Truncate text to a maximum length with optional suffix
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of text
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Pluralize words based on count
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
