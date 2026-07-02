import {
  communityHashtagConfigured,
  findMatchingCommunityHashtag,
  normalizeCommunityHashtags,
  normalizeTelegramHashtag,
} from './telegram-hashtag';

describe('telegram-hashtag helpers', () => {
  it('normalizeTelegramHashtag strips hash, trims, lowercases Cyrillic', () => {
    expect(normalizeTelegramHashtag('#Заслуга')).toBe('заслуга');
    expect(normalizeTelegramHashtag('  #ЗАСЛУГА  ')).toBe('заслуга');
    expect(normalizeTelegramHashtag('idea')).toBe('idea');
  });

  it('normalizeCommunityHashtags deduplicates case variants', () => {
    expect(normalizeCommunityHashtags(['Заслуга', 'заслуга', '#идея'])).toEqual([
      'заслуга',
      'идея',
    ]);
  });

  it('findMatchingCommunityHashtag matches case-insensitive configured tags', () => {
    const configured = ['заслуга', 'идея'];
    expect(findMatchingCommunityHashtag(configured, '#Заслуга отличная работа')).toBe('заслуга');
    expect(findMatchingCommunityHashtag(configured, 'текст без тега')).toBeUndefined();
    expect(findMatchingCommunityHashtag(configured, '#Идея новая')).toBe('идея');
  });

  it('findMatchingCommunityHashtag prefers telegram hashtag entities', () => {
    const configured = ['заслуга'];
    const messageText = '#Заслуга';
    expect(
      findMatchingCommunityHashtag(configured, messageText, [
        { type: 'hashtag', offset: 0, length: messageText.length },
      ]),
    ).toBe('заслуга');
  });

  it('communityHashtagConfigured compares normalized forms', () => {
    expect(communityHashtagConfigured(['заслуга'], 'Заслуга')).toBe(true);
    expect(communityHashtagConfigured(['заслуга'], 'идея')).toBe(false);
  });
});
