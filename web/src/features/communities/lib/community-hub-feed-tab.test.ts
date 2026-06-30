import {
  buildCommunityHubFeedTabHref,
  needsCommunityHubFeedTabSanitize,
  resolveCommunityHubFeedTab,
} from '@/features/communities/lib/community-hub-feed-tab';

const ALL_TABS: readonly ('posts' | 'projects' | 'events' | 'birzha')[] = [
  'posts',
  'projects',
  'events',
  'birzha',
];

describe('resolveCommunityHubFeedTab', () => {
  it('falls back to posts when tab is not visible', () => {
    expect(resolveCommunityHubFeedTab('events', ['posts', 'projects'])).toBe('posts');
  });

  it('keeps visible non-post tabs', () => {
    expect(resolveCommunityHubFeedTab('projects', ALL_TABS)).toBe('projects');
  });

  it('treats unknown params as posts', () => {
    expect(resolveCommunityHubFeedTab('posts', ALL_TABS)).toBe('posts');
  });
});

describe('needsCommunityHubFeedTabSanitize', () => {
  it('flags unknown feedTab values', () => {
    expect(needsCommunityHubFeedTabSanitize('posts', ALL_TABS)).toBe(true);
  });

  it('flags hidden tabs in URL', () => {
    expect(needsCommunityHubFeedTabSanitize('birzha', ['posts', 'projects'])).toBe(true);
  });

  it('does not sanitize valid visible tabs', () => {
    expect(needsCommunityHubFeedTabSanitize('projects', ALL_TABS)).toBe(false);
    expect(needsCommunityHubFeedTabSanitize(null, ALL_TABS)).toBe(false);
  });
});

describe('buildCommunityHubFeedTabHref', () => {
  it('preserves unrelated query params', () => {
    expect(
      buildCommunityHubFeedTabHref(
        '/meriter/communities/abc',
        'sort=voted&q=test',
        'projects',
      ),
    ).toBe('/meriter/communities/abc?sort=voted&q=test&feedTab=projects');
  });

  it('removes feedTab for posts tab', () => {
    expect(
      buildCommunityHubFeedTabHref(
        '/meriter/communities/abc',
        'sort=voted&feedTab=events',
        'posts',
      ),
    ).toBe('/meriter/communities/abc?sort=voted');
  });
});
