import {
  buildDocumentServerRevisionKey,
  hashOfficialJoinedContent,
} from '@/features/documents/lib/document-server-revision';

describe('document-server-revision', () => {
  it('changes revision key when joined official content changes', () => {
    const at = new Date('2026-06-04T12:00:00.000Z');
    const a = buildDocumentServerRevisionKey(at, '<p>One</p>');
    const b = buildDocumentServerRevisionKey(at, '<p>One</p><p>Two</p>');
    expect(a).not.toBe(b);
    expect(hashOfficialJoinedContent('<p>One</p>')).not.toBe(
      hashOfficialJoinedContent('<p>One</p><p>Two</p>'),
    );
  });
});
