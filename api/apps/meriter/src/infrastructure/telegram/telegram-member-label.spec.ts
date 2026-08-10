import {
  formatTelegramMemberLabel,
  isGenericTelegramMemberDisplayName,
} from './telegram-member-label';

describe('formatTelegramMemberLabel', () => {
  it('uses Meriter displayName when set', () => {
    expect(
      formatTelegramMemberLabel(
        { displayName: 'Пётр Тестов', firstName: 'TG', username: 'petr' },
        'uid1',
      ),
    ).toBe('Пётр Тестов');
  });

  it('skips generic displayName and falls back to first/last name', () => {
    expect(
      formatTelegramMemberLabel(
        { displayName: 'Участник', firstName: 'Иван', lastName: 'Петров' },
        'uid2',
      ),
    ).toBe('Иван Петров');
  });

  it('falls back to @username when displayName is generic', () => {
    expect(
      formatTelegramMemberLabel({ displayName: 'Participant', username: 'meriter_user' }, 'uid3'),
    ).toBe('@meriter_user');
  });

  it('detects generic placeholders', () => {
    expect(isGenericTelegramMemberDisplayName('Участник')).toBe(true);
    expect(isGenericTelegramMemberDisplayName('Пётр')).toBe(false);
  });
});
