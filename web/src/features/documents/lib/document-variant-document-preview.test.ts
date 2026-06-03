import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import { buildDocumentVariantPreviewPair } from '@/features/documents/lib/document-variant-document-preview';

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
      {
        id: 'b2',
        order: 1,
        blockType: 'paragraph',
        officialContent: '<p>Beta</p>',
      },
    ],
  },
];

describe('document variant document preview', () => {
  it('joinDocumentWithBlockOverride replaces one block', () => {
    const joined = joinDocumentWithBlockOverride(sections, 'b2', '<p>Beta changed</p>');
    expect(joined).toBe('<p>Alpha</p><p>Beta changed</p>');
  });

  it('buildDocumentVariantPreviewPair keeps other blocks and merges range edit', () => {
    const pair = buildDocumentVariantPreviewPair(sections, 'b2', '<p>Beta</p>', {
      content: '<p>Beta changed</p>',
      rangeStart: 0,
      rangeEnd: 4,
      proposedText: 'Beta changed',
    });
    expect(pair.officialHtml).toBe(joinDocumentBlocksToHtml(sections));
    expect(pair.variantHtml).toBe('<p>Alpha</p><p>Beta changed</p>');
  });
});
