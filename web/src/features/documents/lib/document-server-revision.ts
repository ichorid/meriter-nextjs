import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';

/** Stable fingerprint so editor resyncs when official joined HTML changes, not only `updatedAt`. */
export function hashOfficialJoinedContent(joinedHtml: string): string {
  const plain = blockHtmlToPlainText(joinedHtml);
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    hash = (Math.imul(31, hash) + plain.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function buildDocumentServerRevisionKey(
  updatedAt: string | Date | null | undefined,
  joinedOfficialHtml: string,
): string {
  if (!updatedAt) {
    return '';
  }
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const ms = date.getTime();
  if (Number.isNaN(ms)) {
    return '';
  }
  return `${date.toISOString()}:${hashOfficialJoinedContent(joinedOfficialHtml)}`;
}
