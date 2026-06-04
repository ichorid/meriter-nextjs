import {
  extractListItemFragments,
  joinBlocksToDisplayHtml,
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';

describe('document-html-structure', () => {
  it('extractListItemFragments reads li nodes from a list chunk', () => {
    expect(extractListItemFragments('<ul><li>a</li><li>b</li></ul>')).toEqual([
      '<li>a</li>',
      '<li>b</li>',
    ]);
  });

  it('joinBlocksToDisplayHtml wraps consecutive list-bullet blocks in ul', () => {
    const html = joinBlocksToDisplayHtml([
      { blockType: 'paragraph', officialContent: '<p>Intro</p>' },
      { blockType: 'list-bullet', officialContent: '<li>one</li>' },
      { blockType: 'list-bullet', officialContent: '<li>two</li>' },
    ]);
    expect(html).toBe('<p>Intro</p><ul><li>one</li><li>two</li></ul>');
  });

  it('joinDocumentBlocksToHtml groups list blocks from sections', () => {
    const sections = [
      {
        id: 's1',
        order: 0,
        blocks: [
          {
            id: 'h',
            order: 0,
            blockType: 'heading',
            officialContent: '<h2>Title</h2>',
          },
          {
            id: 'l1',
            order: 1,
            blockType: 'list-bullet',
            officialContent: '<li>alpha</li>',
          },
          {
            id: 'l2',
            order: 2,
            blockType: 'list-bullet',
            officialContent: '<li>beta</li>',
          },
        ],
      },
    ];
    expect(joinDocumentBlocksToHtml(sections)).toBe(
      '<h2>Title</h2><ul><li>alpha</li><li>beta</li></ul>',
    );
  });

  it('joinDocumentWithBlockOverride keeps list grouping', () => {
    const sections = [
      {
        id: 's1',
        order: 0,
        blocks: [
          {
            id: 'b1',
            order: 0,
            blockType: 'list-bullet',
            officialContent: '<li>keep</li>',
          },
          {
            id: 'b2',
            order: 1,
            blockType: 'list-bullet',
            officialContent: '<li>old</li>',
          },
        ],
      },
    ];
    expect(joinDocumentWithBlockOverride(sections, 'b2', '<li>new</li>')).toBe(
      '<ul><li>keep</li><li>new</li></ul>',
    );
  });
});
