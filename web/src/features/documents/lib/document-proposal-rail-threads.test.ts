import { collapseRailThreadsByBlock } from '@/features/documents/lib/document-proposal-rail-threads';

describe('collapseRailThreadsByBlock', () => {
  it('merges threads that share blockId and dedupes variants', () => {
    const collapsed = collapseRailThreadsByBlock([
      {
        threadId: 'legacy-block',
        blockId: 'b1',
        officialExcerpt: 'Intro',
        waveOpen: false,
        variants: [{ id: 'v1' }, { id: 'v2' }],
      },
      {
        threadId: 'thread-uuid',
        blockId: 'b1',
        officialExcerpt: '',
        waveOpen: true,
        variants: [{ id: 'v2' }, { id: 'v3' }],
      },
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.blockId).toBe('b1');
    expect(collapsed[0]!.waveOpen).toBe(true);
    expect(collapsed[0]!.variants.map((v) => v.id).sort()).toEqual(['v1', 'v2', 'v3']);
  });

  it('keeps separate panels for different blocks', () => {
    const collapsed = collapseRailThreadsByBlock([
      {
        threadId: 't1',
        blockId: 'b1',
        officialExcerpt: 'A',
        waveOpen: true,
        variants: [{ id: 'v1' }],
      },
      {
        threadId: 't2',
        blockId: 'b2',
        officialExcerpt: 'B',
        waveOpen: false,
        variants: [{ id: 'v2' }],
      },
    ]);

    expect(collapsed).toHaveLength(2);
  });
});
