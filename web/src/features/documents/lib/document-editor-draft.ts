const DRAFT_PREFIX = 'meriter:document-editor-draft:';

export type DocumentEditorDraft = {
  html: string;
  /** ISO timestamp of `document.updatedAt` when the draft was last saved. */
  serverUpdatedAt: string | null;
};

export function documentEditorDraftKey(documentId: string, userId: string): string {
  return `${DRAFT_PREFIX}${documentId}:${userId}`;
}

function toIsoUpdatedAt(value: string | Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) {
    return null;
  }
  return date.toISOString();
}

function parseStoredDraft(raw: string | null): DocumentEditorDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'html' in parsed &&
      typeof (parsed as DocumentEditorDraft).html === 'string'
    ) {
      const record = parsed as DocumentEditorDraft;
      return {
        html: record.html,
        serverUpdatedAt:
          typeof record.serverUpdatedAt === 'string' ? record.serverUpdatedAt : null,
      };
    }
  } catch {
    // legacy: plain HTML string
  }
  if (raw.length > 0) {
    return { html: raw, serverUpdatedAt: null };
  }
  return null;
}

/** True when the server document revision no longer matches the draft baseline. */
export function isDocumentEditorDraftStale(
  draft: DocumentEditorDraft | null,
  serverUpdatedAt: string | Date | null | undefined,
): boolean {
  if (!draft) {
    return false;
  }
  const serverIso = toIsoUpdatedAt(serverUpdatedAt);
  if (!serverIso) {
    return draft.serverUpdatedAt != null;
  }
  if (!draft.serverUpdatedAt) {
    return true;
  }
  return draft.serverUpdatedAt !== serverIso;
}

export function readDocumentEditorDraft(key: string): DocumentEditorDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return parseStoredDraft(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

export function writeDocumentEditorDraft(
  key: string,
  html: string,
  serverUpdatedAt: string | Date | null | undefined,
): void {
  if (typeof window === 'undefined') {
    return;
  }
  const payload: DocumentEditorDraft = {
    html,
    serverUpdatedAt: toIsoUpdatedAt(serverUpdatedAt),
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
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
