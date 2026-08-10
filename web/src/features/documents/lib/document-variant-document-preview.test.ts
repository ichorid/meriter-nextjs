import {
  joinDocumentBlocksToHtml,
  joinDocumentWithBlockOverride,
} from '@/features/documents/lib/document-html-structure';
import {
  buildDocumentVariantPreviewPair,
  buildDocumentVariantRevisionMarkupHtml,
  shouldBuildVariantHtmlFromPatches,
} from '@/features/documents/lib/document-variant-document-preview';

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

  it('buildDocumentVariantPreviewPair uses per-block patches for multi-block proposals', () => {
    const pair = buildDocumentVariantPreviewPair(sections, 'b2', '<p>Beta</p>', {
      content: '',
      proposalScope: 'patches',
      patches: [
        {
          blockId: 'b1',
          rangeStart: 0,
          rangeEnd: 5,
          proposedText: '<p>Alpha changed</p>',
          previewContent: '<p>Alpha changed</p>',
        },
        {
          blockId: 'b2',
          rangeStart: 0,
          rangeEnd: 4,
          proposedText: '<p>Beta changed</p>',
          previewContent: '<p>Beta changed</p>',
        },
      ],
    });
    expect(pair.officialHtml).toBe(joinDocumentBlocksToHtml(sections));
    expect(pair.variantHtml).toBe('<p>Alpha changed</p><p>Beta changed</p>');
  });

  it('buildDocumentVariantPreviewPair applies insert-after patch when proposalScope is block', () => {
    const pair = buildDocumentVariantPreviewPair(sections, 'b1', '<p>Alpha</p>', {
      content: '<p>Alpha</p><p>Inserted</p><p>Beta</p>',
      proposalScope: 'block',
      patches: [
        {
          blockId: 'b1',
          insertAfterBlockId: 'b1',
          insertBlocks: [{ blockType: 'paragraph', officialContent: '<p>Inserted</p>' }],
          rangeStart: 0,
          rangeEnd: 0,
          proposedText: '',
          previewContent: '<p>Alpha</p><p>Inserted</p><p>Beta</p>',
        },
      ],
    });
    expect(
      shouldBuildVariantHtmlFromPatches({
        proposalScope: 'block',
        patches: [
          {
            blockId: 'b1',
            insertAfterBlockId: 'b1',
            insertBlocks: [{ blockType: 'paragraph', officialContent: '<p>Inserted</p>' }],
            rangeStart: 0,
            rangeEnd: 0,
            proposedText: '',
            previewContent: '',
          },
        ],
      }),
    ).toBe(true);
    expect(pair.officialHtml).toBe('<p>Alpha</p><p>Beta</p>');
    expect(pair.variantHtml).toBe('<p>Alpha</p><p>Inserted</p><p>Beta</p>');
  });

  it('buildDocumentVariantPreviewPair uses full content when patches are absent', () => {
    const pair = buildDocumentVariantPreviewPair(sections, 'b1', '<p>Alpha</p>', {
      content: '<p>Alpha</p><p>Inserted</p><p>Beta</p>',
      proposalScope: 'block',
      rangeStart: 0,
      rangeEnd: 0,
      proposedText: '',
    });
    expect(pair.officialHtml).toBe('<p>Alpha</p><p>Beta</p>');
    expect(pair.variantHtml).toBe('<p>Alpha</p><p>Inserted</p><p>Beta</p>');
  });

  it('buildDocumentVariantRevisionMarkupHtml uses joined plain diff when content is present', () => {
    const markup = buildDocumentVariantRevisionMarkupHtml(
      sections,
      'b1',
      '<p>Alpha</p>',
      {
        content: '<p>Alpha</p><p>Inserted</p><p>Beta</p>',
        proposalScope: 'patches',
        patches: [
          {
            blockId: 'b1',
            insertAfterBlockId: 'b1',
            insertBlocks: [{ blockType: 'paragraph', officialContent: '<p>Inserted</p>' }],
            rangeStart: 0,
            rangeEnd: 0,
            proposedText: '',
            previewContent: '',
          },
        ],
        rangeStart: 0,
        rangeEnd: 0,
        proposedText: '',
      },
    );
    expect(markup).not.toBeNull();
    expect(markup).toContain('Inserted');
  });

  it('buildDocumentVariantPreviewPair prefers stored content over broken patch assembly', () => {
    const longOfficial = `<p>${'A'.repeat(200)} original ending</p>`;
    const longVariant = `<p>${'A'.repeat(200)} replacement ending</p>`;
    const obSections = [
      {
        id: 's1',
        order: 0,
        blocks: [
          {
            id: 'b1',
            order: 0,
            blockType: 'paragraph',
            officialContent: longOfficial,
          },
        ],
      },
    ];
    const pair = buildDocumentVariantPreviewPair(obSections, 'b1', longOfficial, {
      content: longVariant,
      proposalScope: 'patches',
      patches: [
        {
          blockId: 'b1',
          rangeStart: 0,
          rangeEnd: 220,
          proposedText: '',
          previewContent: '<p></p>',
        },
        {
          blockId: 'b1',
          insertAfterBlockId: 'b1',
          insertBlocks: [{ blockType: 'paragraph', officialContent: longVariant }],
          rangeStart: 0,
          rangeEnd: 0,
          proposedText: '',
          previewContent: longVariant,
        },
      ],
    });
    expect(pair.variantHtml).toBe(longVariant);
  });

  it('buildDocumentVariantRevisionMarkupHtml shows character-precise del/ins for joined content', () => {
    const official = '<p>Keep this original tail</p>';
    const variant = '<p>Keep this replacement tail</p>';
    const obSections = [
      {
        id: 's1',
        order: 0,
        blocks: [
          {
            id: 'b1',
            order: 0,
            blockType: 'paragraph',
            officialContent: official,
          },
        ],
      },
    ];
    const markup = buildDocumentVariantRevisionMarkupHtml(obSections, 'b1', official, {
      content: variant,
      proposalScope: 'patches',
      patches: [
        {
          blockId: 'b1',
          rangeStart: 0,
          rangeEnd: 24,
          proposedText: '',
          previewContent: '<p></p>',
        },
      ],
      rangeStart: 0,
      rangeEnd: 24,
      proposedText: '',
    });
    expect(markup).toMatch(/<del[^>]*>[\s\S]*original[\s\S]*<\/del>/);
    expect(markup).toMatch(/<ins[^>]*>[\s\S]*replacement[\s\S]*<\/ins>/);
    expect(markup).toContain('Keep this');
    expect(markup).toContain(' tail');
  });
});
