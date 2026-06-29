import {
  buildGroupWelcomeMessage,
  buildTelegramHelpMessage,
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

  it('group welcome introduces Meriter with configured hashtag', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['идея'],
      platformIntegration: true,
      botUsername: 'meriter_dev1_bot',
    });
    expect(text).toMatch(/^Привет! Я – Меритер/);
    expect(text).toContain('#идея');
    expect(text).toContain('мини-приложении (ссылка ниже)');
    expect(text).not.toContain('Meriter подключён');
  });

  it('group welcome uses custom hashtag from settings', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['предложение'],
    });
    expect(text).toContain('#предложение');
    expect(text).toContain('«#предложение Предлагаю собраться в субботу»');
  });

  it('group welcome adds daily merits paragraph when quota is enabled', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['идея'],
      dailyEmission: 5,
      welcomeMerits: 10,
    });
    expect(text).toContain('Каждый день — 5 заслуг');
    expect(text).toContain('10 приветственных заслуг');
  });

  it('group welcome omits daily merits paragraph when quota is zero', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['идея'],
      dailyEmission: 0,
      welcomeMerits: 10,
    });
    expect(text).not.toContain('Каждый день —');
  });

  it('groupMiniAppLinkHint is set for follow-up message', () => {
    expect(TG_MSG.groupMiniAppLinkHint).toContain('кликните по ссылке ниже');
  });

  it('help lists commands after usage rules', () => {
    const text = buildTelegramHelpMessage('', {
      communityName: 'Test',
      hashtags: ['идея'],
    });
    expect(text).toContain('/balance — ваши заслуги');
    expect(text).toContain('Отправляйте сообщения с #идея');
    expect(text).not.toContain('Заслуги — внутренняя валюта');
  });
});
