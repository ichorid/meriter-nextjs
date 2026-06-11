import type { FeedItem } from '@meriter/shared-types';
import { EntityMappers } from '../src/adapters/mappers/entity-mappers';

function publicationFeedItem(
  id: string,
  score: number,
  createdAt: string,
  isPinned = false,
): FeedItem {
  return {
    id,
    type: 'publication',
    communityId: 'c1',
    authorId: 'u1',
    content: `content-${id}`,
    hashtags: [],
    categories: [],
    metrics: {
      upvotes: score,
      downvotes: 0,
      score,
      commentCount: 0,
    },
    meta: { author: { name: 'Author' } },
    createdAt,
    updatedAt: createdAt,
    isPinned,
  };
}

describe('EntityMappers.sortFeedItems (pinned)', () => {
  it('places pinned publications before unpinned items', () => {
    const items: FeedItem[] = [
      publicationFeedItem('unpinned-high', 100, '2026-01-03T00:00:00.000Z'),
      publicationFeedItem('pinned-low', 1, '2026-01-01T00:00:00.000Z', true),
      publicationFeedItem('unpinned-low', 5, '2026-01-02T00:00:00.000Z'),
    ];

    const sorted = EntityMappers.sortFeedItems(items, 'score');
    expect(sorted.map((i) => i.id)).toEqual([
      'pinned-low',
      'unpinned-high',
      'unpinned-low',
    ]);
  });

  it('sorts pinned group by score when sortBy is score', () => {
    const items: FeedItem[] = [
      publicationFeedItem('pinned-a', 10, '2026-01-01T00:00:00.000Z', true),
      publicationFeedItem('pinned-b', 50, '2026-01-02T00:00:00.000Z', true),
      publicationFeedItem('rest', 999, '2026-01-03T00:00:00.000Z'),
    ];

    const sorted = EntityMappers.sortFeedItems(items, 'score');
    expect(sorted.map((i) => i.id)).toEqual(['pinned-b', 'pinned-a', 'rest']);
  });

  it('sorts pinned group by createdAt when sortBy is recent', () => {
    const items: FeedItem[] = [
      publicationFeedItem('pinned-old', 100, '2026-01-01T00:00:00.000Z', true),
      publicationFeedItem('pinned-new', 1, '2026-01-05T00:00:00.000Z', true),
      publicationFeedItem('rest', 999, '2026-01-03T00:00:00.000Z'),
    ];

    const sorted = EntityMappers.sortFeedItems(items, 'createdAt');
    expect(sorted.map((i) => i.id)).toEqual(['pinned-new', 'pinned-old', 'rest']);
  });
});
