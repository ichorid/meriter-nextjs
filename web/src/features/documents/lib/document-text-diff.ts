/** Strip HTML to plain text for comparison and revision diff. */
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
  if (!hasOfficialText(officialHtml)) return htmlToPlainText(variantHtml).length > 0;
  return normalizePlainText(officialHtml) !== normalizePlainText(variantHtml);
}

export type RevisionToken =
  | { kind: 'same'; value: string }
  | { kind: 'delete'; value: string }
  | { kind: 'insert'; value: string };

function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Word-level revision diff (Google Docs–style): deletions from official, insertions from variant.
 * Returns null when texts are identical.
 */
export function buildRevisionTokens(
  officialHtml: string,
  variantHtml: string,
): RevisionToken[] | null {
  const official = htmlToPlainText(officialHtml);
  const variant = htmlToPlainText(variantHtml);
  if (!variant) return null;
  if (official === variant) return null;

  const a = tokenizeWords(official);
  const b = tokenizeWords(variant);
  if (a.length === 0) {
    return [{ kind: 'insert', value: variant }];
  }
  if (b.length === 0) {
    return a.map((w) => ({ kind: 'delete' as const, value: w }));
  }

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const out: RevisionToken[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
      out.push({ kind: 'same', value: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      out.push({ kind: 'insert', value: b[j - 1]! });
      j--;
    } else {
      out.push({ kind: 'delete', value: a[i - 1]! });
      i--;
    }
  }

  out.reverse();
  if (out.every((t) => t.kind === 'same')) return null;
  return out;
}

/** @deprecated Use buildRevisionTokens; kept for tests. */
export type LiteDiffToken = { kind: 'same' | 'add'; value: string };

export function liteWordDiff(officialHtml: string, variantHtml: string): LiteDiffToken[] | null {
  const tokens = buildRevisionTokens(officialHtml, variantHtml);
  if (!tokens) return null;
  return tokens
    .filter((t) => t.kind !== 'delete')
    .map((t) => ({ kind: t.kind === 'insert' ? 'add' : 'same', value: t.value }));
}
