import {
  isDocumentEditorDraftStale,
  type DocumentEditorDraft,
} from './document-editor-draft';

describe('isDocumentEditorDraftStale', () => {
  const serverAt = '2026-06-03T12:00:00.000Z';

  it('returns false when draft revision matches server', () => {
    const draft: DocumentEditorDraft = {
      html: '<p>a</p>',
      serverUpdatedAt: serverAt,
    };
    expect(isDocumentEditorDraftStale(draft, serverAt)).toBe(false);
  });

  it('returns true when server revision changed', () => {
    const draft: DocumentEditorDraft = {
      html: '<p>old</p>',
      serverUpdatedAt: '2026-06-03T11:00:00.000Z',
    };
    expect(isDocumentEditorDraftStale(draft, serverAt)).toBe(true);
  });

  it('returns true for legacy drafts without serverUpdatedAt', () => {
    const draft: DocumentEditorDraft = {
      html: '<p>legacy</p>',
      serverUpdatedAt: null,
    };
    expect(isDocumentEditorDraftStale(draft, serverAt)).toBe(true);
  });
});
