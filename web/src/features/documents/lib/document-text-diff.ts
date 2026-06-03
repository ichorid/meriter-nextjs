import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';

/** Strip HTML to plain text for comparison and revision diff (preserves paragraph breaks). */
export function htmlToPlainText(html: string): string {
  return blockHtmlToPlainText(html);
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

export type StructuredRevision =
  | { kind: 'flat'; tokens: RevisionToken[] }
  | { kind: 'list'; ordered: boolean; items: RevisionToken[][] };

function tokenizeWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function diffWordTokens(official: string, variant: string): RevisionToken[] | null {
  if (!variant.trim()) {
    if (!official.trim()) return null;
    return tokenizeWords(official).map((w) => ({ kind: 'delete' as const, value: w }));
  }
  if (!official.trim()) {
    return [{ kind: 'insert', value: variant }];
  }
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
  return diffWordTokens(official, variant);
}

function parseHtmlDocument(html: string): Document | null {
  if (typeof DOMParser === 'undefined') {
    return null;
  }
  return new DOMParser().parseFromString(html || '', 'text/html');
}

function htmlContainsList(html: string): 'ul' | 'ol' | null {
  const doc = parseHtmlDocument(html);
  if (!doc) return null;
  if (doc.querySelector('ol')) return 'ol';
  if (doc.querySelector('ul')) return 'ul';
  return null;
}

function resolveListOrdered(
  officialHtml: string,
  variantHtml: string,
  blockType?: string,
): boolean | null {
  if (blockType === 'list-numbered') return true;
  if (blockType === 'list-bullet') return false;
  const variantList = htmlContainsList(variantHtml);
  if (variantList === 'ol') return true;
  if (variantList === 'ul') return false;
  const officialList = htmlContainsList(officialHtml);
  if (officialList === 'ol') return true;
  if (officialList === 'ul') return false;
  return null;
}

function parseListItemsFromHtml(html: string, ordered: boolean): string[] {
  const doc = parseHtmlDocument(html);
  const listTag = ordered ? 'ol' : 'ul';
  if (doc) {
    const list = doc.querySelector(listTag) ?? doc.querySelector(ordered ? 'ul' : 'ol');
    if (list) {
      const items = Array.from(list.querySelectorAll(':scope > li')).map(
        (li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
      if (items.length > 0) {
        return items;
      }
    }
  }
  const plain = htmlToPlainText(html);
  if (!plain) {
    return [''];
  }
  const lines = plain.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [plain];
}

function tokensHaveChanges(tokens: RevisionToken[]): boolean {
  return tokens.some((t) => t.kind !== 'same');
}

/**
 * Builds a structured revision preserving list items when content is list-shaped.
 */
export function buildStructuredRevision(
  officialHtml: string,
  variantHtml: string,
  blockType?: string,
): StructuredRevision | null {
  const ordered = resolveListOrdered(officialHtml, variantHtml, blockType);
  if (ordered !== null) {
    const officialItems = parseListItemsFromHtml(officialHtml, ordered);
    const variantItems = parseListItemsFromHtml(variantHtml, ordered);
    const itemCount = Math.max(officialItems.length, variantItems.length);
    const items: RevisionToken[][] = [];

    for (let i = 0; i < itemCount; i++) {
      const officialItem = officialItems[i] ?? '';
      const variantItem = variantItems[i] ?? '';
      const itemTokens =
        diffWordTokens(officialItem, variantItem) ??
        (variantItem ? [{ kind: 'same' as const, value: variantItem }] : null);
      if (itemTokens && tokensHaveChanges(itemTokens)) {
        items.push(itemTokens);
      } else if (variantItem) {
        items.push([{ kind: 'same', value: variantItem }]);
      } else if (officialItem) {
        items.push([{ kind: 'delete', value: officialItem }]);
      }
    }

    const flatOfficial = officialItems.join('\n');
    const flatVariant = variantItems.join('\n');
    if (flatOfficial === flatVariant) return null;
    if (items.length === 0) return null;
    if (items.every((row) => row.every((t) => t.kind === 'same'))) return null;

    return { kind: 'list', ordered, items };
  }

  const tokens = buildRevisionTokens(officialHtml, variantHtml);
  return tokens ? { kind: 'flat', tokens } : null;
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
