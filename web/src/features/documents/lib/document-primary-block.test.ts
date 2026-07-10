import { getPrimaryDocumentBlock } from './document-primary-block';

const sections = [
  {
    id: 's1',
    title: '',
    order: 0,
    blocks: [
      {
        id: 'before',
        order: 0,
        blockType: 'paragraph',
        officialContent: '<p>Before</p>',
        lockedRanges: [],
      },
      {
        id: 'pinned',
        order: 1,
        blockType: 'paragraph',
        officialContent: '<p>Pinned</p>',
        lockedRanges: [{ rangeStart: 0, rangeEnd: 6 }],
      },
      {
        id: 'after',
        order: 2,
        blockType: 'paragraph',
        officialContent: '<p>After</p>',
        lockedRanges: [],
      },
    ],
  },
];

describe('getPrimaryDocumentBlock', () => {
  it('maps per-block locks into unified editor plain offsets', () => {
    const primary = getPrimaryDocumentBlock(sections);
    expect(primary).not.toBeNull();
    expect(primary!.lockedRanges).toEqual([{ rangeStart: 6, rangeEnd: 12 }]);
    expect(primary!.officialHtml).toContain('Before');
    expect(primary!.officialHtml).toContain('Pinned');
    expect(primary!.officialHtml).toContain('After');
  });
});
