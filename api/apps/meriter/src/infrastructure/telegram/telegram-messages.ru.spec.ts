import {
  buildGroupWelcomeMessage,
  buildTelegramHelpMessage,
  buildTelegramMiniAppStartLink,
  buildSettingsLeadSummary,
  buildVoteAmountGroupMentionMessage,
  communitySettingsSnapshot,
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
    expect(text).toMatch(/^Привет!\n\nЯ – Меритер/);
    expect(text).toContain('1. Отправляйте сообщения с #идея');
    expect(text).toContain('2. Голосуйте за такие сообщения');
    expect(text).toContain('3. Проверяйте свой баланс');
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
    expect(text).toContain('\n\nНовым участникам — 10 приветственных заслуг.');
  });

  it('group welcome shows welcome merits when daily quota is zero', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['идея'],
      dailyEmission: 0,
      welcomeMerits: 100,
    });
    expect(text).not.toContain('Каждый день —');
    expect(text).toContain('\n\nНовым участникам — 100 приветственных заслуг.');
  });

  it('group welcome omits daily merits paragraph when quota is zero', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['идея'],
      dailyEmission: 0,
      welcomeMerits: 0,
    });
    expect(text).not.toContain('Каждый день —');
    expect(text).not.toContain('Новым участникам');
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
    expect(text).toContain('/guide — подробный гайд');
    expect(text).toContain('1. Отправляйте сообщения с #идея');
    expect(text).not.toContain('Заслуги — внутренняя валюта');
  });

  it('settings summary lists editable fields without post ack toggle', () => {
    const text = buildSettingsLeadSummary({
      name: 'Клуб',
      hashtags: ['идея'],
      settings: { dailyEmission: 5, postCost: 1 },
      meritSettings: { startingMerits: 10 },
    });
    expect(text).toContain('«Клуб»');
    expect(text).toContain('5 заслуг в день');
    expect(text).toContain('#идея');
    expect(text).not.toContain('Пост сохранён');
  });

  it('settingsUpdated reflects snapshot', () => {
    const snapshot = communitySettingsSnapshot({
      name: 'Клуб',
      hashtags: ['идея'],
      settings: { dailyEmission: 0, postCost: 2 },
      meritSettings: { startingMerits: 0 },
    });
    expect(TG_MSG.settingsUpdated(snapshot)).toContain('выключена');
    expect(TG_MSG.settingsUpdated(snapshot)).toContain('2 заслуг');
  });

  it('reactionPostNotFound uses community hashtag', () => {
    expect(TG_MSG.reactionPostNotFound('идея')).toContain('#идея');
    expect(TG_MSG.reactionPostNotFound('идея')).not.toContain('сохранённым');
  });

  it('voteSuccess includes voter name', () => {
    expect(TG_MSG.voteSuccess('Иван', 5, 'up')).toBe('Иван начислил автору 5 заслуг.');
    expect(TG_MSG.voteSuccess('Мария', 3, 'down')).toBe('Мария списал у автора 3 заслуг.');
  });

  it('vote amount group prompt mentions voter at start', () => {
    const { text, entities } = buildVoteAmountGroupMentionMessage(900002, 'TG User', 'up');
    expect(text.startsWith('TG User,')).toBe(true);
    expect(entities[0]?.type).toBe('text_mention');
    expect(entities[0]?.user.id).toBe(900002);
  });
});
