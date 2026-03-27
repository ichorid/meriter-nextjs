/**
 * Strip HTML tags and collapse whitespace (no length cap).
 */
export function htmlOrTextToPlain(htmlOrText: string): string {
  return htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Strip HTML tags and collapse whitespace for one-line previews (avoids invalid <p> inside <p>).
 */
export function plainTextExcerpt(htmlOrText: string, maxLen = 280): string {
  const stripped = htmlOrTextToPlain(htmlOrText);
  if (stripped.length <= maxLen) {
    return stripped;
  }
  return `${stripped.slice(0, maxLen)}…`;
}

/**
 * First N words for card previews; if the text has more words, append … and set hasMore.
 */
export function firstWordsPreview(text: string, maxWords: number): { preview: string; hasMore: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { preview: '', hasMore: false };
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return { preview: trimmed, hasMore: false };
  return { preview: `${words.slice(0, maxWords).join(' ')}…`, hasMore: true };
}
