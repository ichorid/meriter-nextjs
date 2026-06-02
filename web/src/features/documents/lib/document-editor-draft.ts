const DRAFT_PREFIX = 'meriter:document-editor-draft:';

export function documentEditorDraftKey(documentId: string, userId: string): string {
  return `${DRAFT_PREFIX}${documentId}:${userId}`;
}

export function readDocumentEditorDraft(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDocumentEditorDraft(key: string, html: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(key, html);
  } catch {
    // ignore quota / private mode
  }
}

export function clearDocumentEditorDraft(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
