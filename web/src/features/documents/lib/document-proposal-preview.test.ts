import { buildJoinedHtmlFromPatches } from '@/features/documents/lib/document-proposal-joined-html';
import { buildJoinedPlainTextRevisionHtml } from '@/features/documents/lib/document-joined-plain-revision-html';

const sections = [
  {
    id: 's1',
    order: 0,
    blocks: [
      {
        id: 'b1',
        order: 0,
        blockType: 'paragraph',
        officialContent: '<p>Alpha</p>',
      },
    ],
  },
];

describe('buildJoinedHtmlFromPatches', () => {
  it('renders insert blocks when anchor block was fully deleted', () => {
    const html = buildJoinedHtmlFromPatches(sections, [
      {
        blockId: 'b1',
        rangeStart: 0,
        rangeEnd: 5,
        proposedText: '',
        previewContent: '<p></p>',
      },
      {
        blockId: 'b1',
        insertAfterBlockId: 'b1',
        insertBlocks: [{ blockType: 'paragraph', officialContent: '<p>Replacement</p>' }],
        rangeStart: 0,
        rangeEnd: 0,
        proposedText: '',
        previewContent: '<p>Replacement</p>',
      },
    ]);
    expect(html).toBe('<p>Replacement</p>');
  });
});

describe('buildJoinedPlainTextRevisionHtml', () => {
  it('marks only the changed tail character-precisely', () => {
    const official = '<p>Long prefix original ending</p>';
    const variant = '<p>Long prefix replacement ending</p>';
    const markup = buildJoinedPlainTextRevisionHtml(official, variant);
    expect(markup).toContain('Long prefix');
    expect(markup).toContain(' ending');
    expect(markup).toMatch(/<del[^>]*>[\s\S]*original[\s\S]*<\/del>/);
    expect(markup).toMatch(/<ins[^>]*>[\s\S]*replacement[\s\S]*<\/ins>/);
    expect(markup).toContain('Long prefix');
  });
});
