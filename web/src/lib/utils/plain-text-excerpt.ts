/**
 * Strip HTML tags and collapse whitespace for one-line previews (avoids invalid <p> inside <p>).
 */
export function plainTextExcerpt(htmlOrText: string, maxLen = 280): string {
  const stripped = htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= maxLen) {
    return stripped;
  }
  return `${stripped.slice(0, maxLen)}…`;
}
