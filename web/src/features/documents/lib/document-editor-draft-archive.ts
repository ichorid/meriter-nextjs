import { isEmptyTipTapHtml } from '@/features/documents/lib/document-canvas-shared';
import { blockHtmlToPlainText } from '@/features/documents/lib/document-plain-text';
import type { DocumentEditorDraft } from './document-editor-draft';

const ARCHIVE_LIST_PREFIX = 'meriter:document-editor-draft-archive:';
const MAX_ARCHIVES_PER_DOCUMENT = 5;

export type DocumentEditorDraftArchiveReason = 'remote_update' | 'user_choice';

export type DocumentEditorDraftArchiveEntry = {
  id: string;
  documentId: string;
  userId: string;
  html: string;
  serverUpdatedAt: string | null;
  archivedAt: string;
  reason: DocumentEditorDraftArchiveReason;
};

function archiveListKey(documentId: string, userId: string): string {
  return `${ARCHIVE_LIST_PREFIX}${documentId}:${userId}`;
}

function readArchiveList(key: string): DocumentEditorDraftArchiveEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is DocumentEditorDraftArchiveEntry =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof (item as DocumentEditorDraftArchiveEntry).id === 'string' &&
            typeof (item as DocumentEditorDraftArchiveEntry).html === 'string',
        ),
    );
  } catch {
    return [];
  }
}

function normalizeForEditorCompare(html: string): string {
  return html
    .trim()
    .replace(/(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/gi, '')
    .trim();
}

/**
 * Version picker visibility:
 * - server view, no archived drafts → hidden
 * - server view, has archived drafts → visible
 * - any non-server view (live or archived draft) → visible
 */
export function shouldShowDocumentVersionPicker(
  isServerActive: boolean,
  archivedDraftCount: number,
): boolean {
  if (!isServerActive) {
    return true;
  }
  return archivedDraftCount > 0;
}

/** Loose equality for TipTap vs server HTML (avoids false dirty on open). */
export function documentEditorHtmlEquals(a: string, b: string): boolean {
  const left = normalizeForEditorCompare(a);
  const right = normalizeForEditorCompare(b);
  if (left === right) {
    return true;
  }
  if (isEmptyTipTapHtml(left) && isEmptyTipTapHtml(right)) {
    return true;
  }
  return blockHtmlToPlainText(left) === blockHtmlToPlainText(right);
}

function writeArchiveList(key: string, entries: DocumentEditorDraftArchiveEntry[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ARCHIVES_PER_DOCUMENT)));
  } catch {
    // ignore quota / private mode
  }
}

export function shouldArchiveDocumentEditorDraft(
  draft: DocumentEditorDraft,
  serverBaselineHtml: string,
  existing: DocumentEditorDraftArchiveEntry[],
): boolean {
  const html = draft.html.trim();
  if (!html) {
    return false;
  }
  if (documentEditorHtmlEquals(draft.html, serverBaselineHtml)) {
    return false;
  }
  const latest = existing[0];
  if (latest && documentEditorHtmlEquals(draft.html, latest.html)) {
    return false;
  }
  return true;
}

export function archiveDocumentEditorDraft(
  documentId: string,
  userId: string,
  draft: DocumentEditorDraft,
  reason: DocumentEditorDraftArchiveReason,
): DocumentEditorDraftArchiveEntry | null {
  const html = draft.html.trim();
  if (!html) {
    return null;
  }

  const key = archiveListKey(documentId, userId);
  const existing = readArchiveList(key);
  if (latestDuplicate(existing, draft.html)) {
    return null;
  }

  const entry: DocumentEditorDraftArchiveEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    documentId,
    userId,
    html: draft.html,
    serverUpdatedAt: draft.serverUpdatedAt,
    archivedAt: new Date().toISOString(),
    reason,
  };

  writeArchiveList(key, [entry, ...existing]);
  return entry;
}

function latestDuplicate(
  existing: DocumentEditorDraftArchiveEntry[],
  html: string,
): boolean {
  const latest = existing[0];
  return Boolean(latest && documentEditorHtmlEquals(latest.html, html));
}

export function listArchivedDocumentEditorDrafts(
  documentId: string,
  userId: string,
): DocumentEditorDraftArchiveEntry[] {
  return readArchiveList(archiveListKey(documentId, userId));
}

export function removeArchivedDocumentEditorDraft(
  documentId: string,
  userId: string,
  archiveId: string,
): void {
  const key = archiveListKey(documentId, userId);
  const next = readArchiveList(key).filter((e) => e.id !== archiveId);
  writeArchiveList(key, next);
}
