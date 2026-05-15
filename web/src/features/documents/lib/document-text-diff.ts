/** Strip HTML to plain text for comparison and lite diff. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePlainText(html: string): string {
  return htmlToPlainText(html).toLowerCase();
}

export function hasOfficialText(officialHtml: string): boolean {
  return htmlToPlainText(officialHtml).length > 0;
}

export function variantDiffersFromOfficial(officialHtml: string, variantHtml: string): boolean {
  if (!hasOfficialText(officialHtml)) return false;
  const official = normalizePlainText(officialHtml);
  const variant = normalizePlainText(variantHtml);
  if (!variant) return false;
  return official !== variant;
}

export type LiteDiffToken = { kind: 'same' | 'add'; value: string };

/**
 * Word-level lite diff: words in variant not present in official (case-insensitive) are "add".
 * Returns null when texts match or only word order differs.
 */
export function liteWordDiff(officialHtml: string, variantHtml: string): LiteDiffToken[] | null {
  const official = htmlToPlainText(officialHtml);
  const variant = htmlToPlainText(variantHtml);
  if (!variant || !official) return null;
  if (official === variant) return null;

  const officialWords = official.split(/\s+/).filter(Boolean);
  const variantWords = variant.split(/\s+/).filter(Boolean);
  const officialSet = new Set(officialWords.map((w) => w.toLowerCase()));

  const tokens: LiteDiffToken[] = variantWords.map((w) =>
    officialSet.has(w.toLowerCase()) ? { kind: 'same', value: w } : { kind: 'add', value: w },
  );

  if (tokens.every((t) => t.kind === 'same')) {
    return null;
  }

  return tokens;
}
