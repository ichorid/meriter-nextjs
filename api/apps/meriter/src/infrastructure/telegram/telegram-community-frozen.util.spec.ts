import {
  isTelegramCommunityFrozen,
  mongoActiveTelegramCommunityFilter,
  mongoFrozenTelegramCommunityFilter,
} from './telegram-community-frozen.util';

describe('isTelegramCommunityFrozen', () => {
  it('returns false when field is absent', () => {
    expect(isTelegramCommunityFrozen({})).toBe(false);
  });

  it('returns false when field is null', () => {
    expect(isTelegramCommunityFrozen({ telegramFrozenAt: null })).toBe(false);
  });

  it('returns true for valid Date', () => {
    expect(isTelegramCommunityFrozen({ telegramFrozenAt: new Date('2026-01-01') })).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isTelegramCommunityFrozen({ telegramFrozenAt: 'not-a-date' })).toBe(false);
  });
});

describe('mongoActiveTelegramCommunityFilter', () => {
  it('matches absent or null frozen timestamps', () => {
    expect(mongoActiveTelegramCommunityFilter()).toEqual({
      $or: [{ telegramFrozenAt: { $exists: false } }, { telegramFrozenAt: null }],
    });
  });
});

describe('mongoFrozenTelegramCommunityFilter', () => {
  it('requires a date value', () => {
    expect(mongoFrozenTelegramCommunityFilter()).toEqual({
      telegramFrozenAt: { $exists: true, $ne: null, $type: 'date' },
    });
  });
});
