import { filterDocumentBlockPanelVotes } from '../src/domain/common/document-block-panel-votes.util';

describe('filterDocumentBlockPanelVotes', () => {
  const documentId = 'doc1';
  const blockId = 'block1';
  const officialTargetId = `${documentId}::${blockId}`;
  const waveStart = new Date('2026-06-01T12:00:00.000Z');

  const votes = [
    {
      targetType: 'document-block-official',
      targetId: officialTargetId,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
    },
    {
      targetType: 'document-block-official',
      targetId: officialTargetId,
      createdAt: new Date('2026-06-02T10:00:00.000Z'),
    },
    {
      targetType: 'document-variant',
      targetId: 'variant-old',
      createdAt: new Date('2026-06-03T10:00:00.000Z'),
    },
    {
      targetType: 'document-variant',
      targetId: 'variant-open',
      createdAt: new Date('2026-06-03T11:00:00.000Z'),
    },
  ];

  it('drops pre-wave official votes and inactive variant votes', () => {
    const filtered = filterDocumentBlockPanelVotes(votes, {
      documentId,
      blockId,
      currentWaveStartedAt: waveStart,
      activeVariantIds: ['variant-open'],
    });

    expect(filtered.map((v) => v.targetId)).toEqual([officialTargetId, 'variant-open']);
    expect(filtered).toHaveLength(2);
  });

  it('keeps all matching votes when wave anchor is absent', () => {
    const filtered = filterDocumentBlockPanelVotes(votes, {
      documentId,
      blockId,
      currentWaveStartedAt: null,
      activeVariantIds: ['variant-old', 'variant-open'],
    });

    expect(filtered).toHaveLength(4);
  });
});
