import {
  archiveDocumentEditorDraft,
  documentEditorHtmlEquals,
  listArchivedDocumentEditorDrafts,
  removeArchivedDocumentEditorDraft,
  shouldArchiveDocumentEditorDraft,
  shouldShowDocumentVersionPicker,
} from './document-editor-draft-archive';

describe('document-editor-draft-archive', () => {
  const documentId = 'doc-1';
  const userId = 'user-1';
  const storage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    const localStorageMock = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      },
      key: () => null,
      length: 0,
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  });

  it('archives and lists drafts newest first', () => {
    archiveDocumentEditorDraft(documentId, userId, { html: '<p>first</p>', serverUpdatedAt: null }, 'remote_update');
    archiveDocumentEditorDraft(documentId, userId, { html: '<p>second</p>', serverUpdatedAt: null }, 'user_choice');

    const list = listArchivedDocumentEditorDrafts(documentId, userId);
    expect(list).toHaveLength(2);
    expect(list[0]?.html).toBe('<p>second</p>');
    expect(list[1]?.html).toBe('<p>first</p>');
  });

  it('removes a single archived entry', () => {
    const entry = archiveDocumentEditorDraft(
      documentId,
      userId,
      { html: '<p>x</p>', serverUpdatedAt: null },
      'remote_update',
    );
    expect(entry).not.toBeNull();
    removeArchivedDocumentEditorDraft(documentId, userId, entry!.id);
    expect(listArchivedDocumentEditorDrafts(documentId, userId)).toHaveLength(0);
  });

  it('does not duplicate the latest archived html', () => {
    archiveDocumentEditorDraft(
      documentId,
      userId,
      { html: '<p>same</p>', serverUpdatedAt: null },
      'user_choice',
    );
    const second = archiveDocumentEditorDraft(
      documentId,
      userId,
      { html: '<p>same</p>', serverUpdatedAt: null },
      'user_choice',
    );
    expect(second).toBeNull();
    expect(listArchivedDocumentEditorDrafts(documentId, userId)).toHaveLength(1);
  });

  it('shouldArchive returns false when html matches server or latest archive', () => {
    const existing = archiveDocumentEditorDraft(
      documentId,
      userId,
      { html: '<p>draft</p>', serverUpdatedAt: null },
      'remote_update',
    );
    expect(
      shouldArchiveDocumentEditorDraft(
        { html: '<p>server</p>', serverUpdatedAt: null },
        '<p>server</p>',
        existing ? [existing] : [],
      ),
    ).toBe(false);
    expect(
      shouldArchiveDocumentEditorDraft(
        { html: '<p>draft</p>', serverUpdatedAt: null },
        '<p>server</p>',
        existing ? [existing] : [],
      ),
    ).toBe(false);
    expect(
      shouldArchiveDocumentEditorDraft(
        { html: '<p>new</p>', serverUpdatedAt: null },
        '<p>server</p>',
        existing ? [existing] : [],
      ),
    ).toBe(true);
  });

  it('shouldShowDocumentVersionPicker follows server vs draft rules', () => {
    expect(shouldShowDocumentVersionPicker(true, 0)).toBe(false);
    expect(shouldShowDocumentVersionPicker(true, 2)).toBe(true);
    expect(shouldShowDocumentVersionPicker(false, 0)).toBe(true);
    expect(shouldShowDocumentVersionPicker(false, 1)).toBe(true);
  });

  it('documentEditorHtmlEquals treats same plain text as equal', () => {
    expect(
      documentEditorHtmlEquals('<p>Hello</p>', '<p>Hello</p><p><br></p>'),
    ).toBe(true);
  });

  it('skips empty html archives', () => {
    const entry = archiveDocumentEditorDraft(
      documentId,
      userId,
      { html: '   ', serverUpdatedAt: null },
      'remote_update',
    );
    expect(entry).toBeNull();
    expect(listArchivedDocumentEditorDrafts(documentId, userId)).toHaveLength(0);
  });
});
