import {
  isTelegramDownvoteEmoji,
  isTelegramHeartEmoji,
  isTelegramUpvoteEmoji,
  normalizeTelegramReactionEmoji,
  reactionTypeKey,
} from './telegram-reaction-emoji';

describe('telegram-reaction-emoji', () => {
  it('normalizes thumbs up with skin tone to base thumb', () => {
    expect(normalizeTelegramReactionEmoji('👍🏻')).toBe('👍');
    expect(isTelegramUpvoteEmoji('👍🏻')).toBe(true);
  });

  it('matches plain thumbs up and heart variants', () => {
    expect(isTelegramUpvoteEmoji('👍')).toBe(true);
    expect(isTelegramHeartEmoji('❤️')).toBe(true);
    expect(isTelegramDownvoteEmoji('👎')).toBe(true);
    expect(isTelegramDownvoteEmoji('🤡')).toBe(true);
  });

  it('builds stable reaction type keys', () => {
    expect(reactionTypeKey({ type: 'emoji', emoji: '👍🏻' })).toBe('emoji:👍');
    expect(reactionTypeKey({ type: 'emoji', emoji: '👍' })).toBe('emoji:👍');
  });
});
