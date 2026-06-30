import {
  concatOfficialPlainTextFromDraft,
  createEmptyDocumentDraft,
  documentDraftHasOfficialText,
  serializeDraftForApi,
} from './document-draft';

describe('document-draft', () => {
  it('createEmptyDocumentDraft starts with one paragraph block', () => {
    const draft = createEmptyDocumentDraft();
    expect(draft.sections).toHaveLength(1);
    expect(draft.sections[0]?.blocks).toHaveLength(1);
    expect(documentDraftHasOfficialText(draft)).toBe(false);
  });

  it('concatOfficialPlainTextFromDraft strips HTML', () => {
    const draft = createEmptyDocumentDraft();
    const block = draft.sections[0]?.blocks?.[0];
    if (!block) throw new Error('missing block');
    block.officialContent = '<p>Hello <strong>world</strong></p>';
    expect(concatOfficialPlainTextFromDraft(draft)).toBe('Hello world');
    expect(documentDraftHasOfficialText(draft)).toBe(true);
  });

  it('serializeDraftForApi omits client ids', () => {
    const draft = createEmptyDocumentDraft();
    const block = draft.sections[0]?.blocks?.[0];
    if (!block) throw new Error('missing block');
    block.officialContent = '<p>Seed</p>';
    const seed = serializeDraftForApi(draft);
    expect(seed.sections[0]?.blocks[0]).toEqual({
      order: 0,
      blockType: 'paragraph',
      officialContent: '<p>Seed</p>',
    });
  });
});
