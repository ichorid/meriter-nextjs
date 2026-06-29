import {
  buildGroupWelcomeMessage,
  buildTelegramMiniAppStartLink,
  TG_MSG,
} from './telegram-messages.ru';

describe('telegram group welcome copy', () => {
  it('buildTelegramMiniAppStartLink uses t.me without scheme', () => {
    expect(buildTelegramMiniAppStartLink('meriter_dev1_bot')).toBe(
      't.me/meriter_dev1_bot?startapp',
    );
    expect(buildTelegramMiniAppStartLink('@meriter_dev1_bot', 'comm-123')).toBe(
      't.me/meriter_dev1_bot?startapp=comm-123',
    );
  });

  it('group welcome starts with Meriter подключён without inline open-app hint', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      platformIntegration: true,
      botUsername: 'meriter_dev1_bot',
    });
    expect(text).toMatch(/^Meriter подключён/);
    expect(text).not.toContain('Откройте приложение Meriter — там баланс');
  });

  it('groupMiniAppLinkHint is set for follow-up message', () => {
    expect(TG_MSG.groupMiniAppLinkHint).toContain('кликните по ссылке ниже');
  });
});
