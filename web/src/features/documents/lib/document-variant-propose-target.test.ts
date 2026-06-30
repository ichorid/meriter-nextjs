import { blockHtmlToPlainText, blockHtmlToPlainTextForDiff } from '@/features/documents/lib/document-plain-text';
import { resolveBlockProposeMutationPayload } from '@/features/documents/lib/document-variant-propose-target';

const sections = [
  {
    id: 'sec-1',
    blocks: [
      {
        id: 'block-a',
        order: 0,
        blockType: 'paragraph',
        officialContent:
          '<p>Меритер — это среда. Тест прямой правки. Мир, где заслуга измерима.</p>',
      },
    ],
  },
];

describe('resolveBlockProposeMutationPayload', () => {
  it('sends joined document HTML without the selected phrase after a partial edit', () => {
    const official = sections[0]!.blocks[0]!.officialContent as string;
    const plain = blockHtmlToPlainText(official);
    const rangeStart = plain.indexOf('Тест');
    const rangeEnd = plain.indexOf('правки') + 'правки'.length;

    const payload = resolveBlockProposeMutationPayload(
      sections,
      'block-a',
      official,
      '<p>Т</p>',
      { rangeStart, rangeEnd },
    );

    expect(payload.content).not.toContain('Тест прямой правки');
    expect(payload.content).toContain('Мир, где заслуга измерима');
    expect(payload.blockId).toBe('block-a');
  });

  it('sends joined document HTML when deleting a lone character line', () => {
    const official =
      '<p>Before.</p><p>Т</p><p><strong>Heading</strong></p>';
    const edited = '<p>Before.</p><p></p><p><strong>Heading</strong></p>';
    const singleSection = [
      {
        id: 'sec-1',
        blocks: [
          { id: 'b1', order: 0, blockType: 'paragraph', officialContent: official },
        ],
      },
    ];
    const payload = resolveBlockProposeMutationPayload(
      singleSection,
      'b1',
      official,
      edited,
    );
    expect(blockHtmlToPlainTextForDiff(payload.content)).not.toMatch(/\nТ\n/);
    expect(blockHtmlToPlainText(payload.content)).not.toContain('Т');
  });

  it('includes a single-character insertion in joined content', () => {
    const official = '<p>Hello</p>';
    const singleSection = [
      {
        id: 'sec-1',
        blocks: [
          { id: 'b1', order: 0, blockType: 'paragraph', officialContent: official },
        ],
      },
    ];
    const payload = resolveBlockProposeMutationPayload(
      singleSection,
      'b1',
      official,
      '!',
      { rangeStart: 5, rangeEnd: 5 },
    );
    expect(payload.content).toContain('!');
  });
});
