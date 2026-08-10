import {
  DOC_REVISION_DELETE_CLASS,
  DOC_REVISION_INSERT_CLASS,
} from '@/features/documents/lib/document-revision-styles';
import {
  buildPlainTextWordDiff,
  type RevisionToken,
} from '@/features/documents/lib/document-text-diff';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Merge adjacent tokens of the same kind (del/ins/same) for cleaner markup. */
export function collapseRevisionTokens(tokens: RevisionToken[]): RevisionToken[] {
  const out: RevisionToken[] = [];
  for (const token of tokens) {
    const last = out[out.length - 1];
    if (last && last.kind === token.kind) {
      last.value = `${last.value} ${token.value}`;
      continue;
    }
    out.push({ ...token });
  }
  return out;
}

export function renderRevisionTokensToDelInsHtml(tokens: RevisionToken[]): string {
  return collapseRevisionTokens(tokens)
    .map((token) => {
      const escaped = escapeHtml(token.value).replace(/\n/g, '<br>');
      if (token.kind === 'delete') {
        return `<del class="${DOC_REVISION_DELETE_CLASS}">${escaped}</del>`;
      }
      if (token.kind === 'insert') {
        return `<ins class="${DOC_REVISION_INSERT_CLASS}">${escaped}</ins>`;
      }
      return escaped;
    })
    .join(' ');
}

/**
 * Word-level <del>/<ins> HTML for a contiguous plain-text change span.
 * Falls back to a single del+ins pair when word diff finds no granular changes.
 */
export function buildWordLevelRevisionReplacementHtml(
  deletedPlain: string,
  insertedPlain: string,
): string {
  const tokens = buildPlainTextWordDiff(deletedPlain, insertedPlain);
  if (tokens && tokens.some((t) => t.kind !== 'same')) {
    return renderRevisionTokensToDelInsHtml(tokens);
  }

  const delPart = deletedPlain
    ? `<del class="${DOC_REVISION_DELETE_CLASS}">${escapeHtml(deletedPlain).replace(/\n/g, '<br>')}</del>`
    : '';
  const insPart = insertedPlain.trim()
    ? `<ins class="${DOC_REVISION_INSERT_CLASS}">${escapeHtml(insertedPlain).replace(/\n/g, '<br>')}</ins>`
    : '';
  return delPart && insPart ? `${delPart}${insPart}` : insPart || delPart;
}
