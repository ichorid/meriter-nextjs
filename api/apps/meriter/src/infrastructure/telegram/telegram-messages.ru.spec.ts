import {
  buildGroupWelcomeMessage,
  buildTelegramBotOpenKeyboard,
  buildTelegramBotStartLink,
  buildTelegramHelpMessage,
  buildTelegramMiniAppStartLink,
  buildSettingsLeadSummary,
  buildVoteAmountGroupMentionMessage,
  buildVoteAmountGroupNumericMentionMessage,
  communitySettingsSnapshot,
  formatVoteAmountBalanceHint,
  getOnboardingPrompt,
  TG_BOT_OPEN_BUTTON_LABELS,
  TG_MSG,
} from './telegram-messages.ru';

describe('telegram group welcome copy', () => {
  it('buildTelegramMiniAppStartLink uses t.me without scheme', () => {
    expect(buildTelegramMiniAppStartLink('meriter_bot')).toBe(
      't.me/meriter_bot?startapp',
    );
    expect(buildTelegramMiniAppStartLink('@meriter_bot', 'comm-123')).toBe(
      't.me/meriter_bot?startapp=comm-123',
    );
  });

  it('buildTelegramBotStartLink builds https deep link with start payload', () => {
    expect(buildTelegramBotStartLink('meriter_bot', 'guide')).toBe(
      'https://t.me/meriter_bot?start=guide',
    );
    const keyboard = buildTelegramBotOpenKeyboard(
      'meriter_bot',
      'guide',
      TG_BOT_OPEN_BUTTON_LABELS.guide,
    );
    expect(keyboard.inline_keyboard[0][0]).toEqual({
      text: TG_BOT_OPEN_BUTTON_LABELS.guide,
      url: 'https://t.me/meriter_bot?start=guide',
    });
  });

  it('guideDmFailed mentions @handle and open-bot button flow', () => {
    expect(TG_MSG.guideDmFailed('meriter_bot')).toContain('@meriter_bot');
    expect(TG_MSG.guideDmFailed('meriter_bot')).toContain('кнопку ниже');
    expect(TG_MSG.voteAmountDmFailed('meriter_bot')).toContain('повторите реакцию');
  });

  it('group welcome introduces Meriter with configured hashtag and spacing', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
      platformIntegration: true,
      botUsername: 'meriter_bot',
    });
    expect(text).toMatch(/^Привет!\n\nЯ – Меритер/);
    expect(text).toContain('1. Публикуйте посты с #заслуга, чтобы собирать заслуги для себя');
    expect(text).toContain('\n\n2. Голосуйте за чужие посты с #заслуга реакциями');
    expect(text).toContain('\n\n3. Проверяйте баланс и историю');
    expect(text).not.toContain('Meriter подключён');
    expect(text).not.toContain('• Пример:');
  });

  it('group welcome uses custom hashtag from settings', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['предложение'],
    });
    expect(text).toContain('#предложение');
    expect(text).toContain('«#предложение для @username»');
  });

  it('group welcome adds daily merits paragraph when quota is enabled', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
      dailyEmission: 5,
      welcomeMerits: 10,
    });
    expect(text).toContain('Каждый день вы получаете 5 заслуг');
    expect(text).toContain('\n\nНовым участникам — 10 приветственных заслуг.');
  });

  it('group welcome shows welcome merits when daily quota is zero', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
      dailyEmission: 0,
      welcomeMerits: 100,
    });
    expect(text).not.toContain('Каждый день вы получаете');
    expect(text).toContain('\n\nНовым участникам — 100 приветственных заслуг.');
  });

  it('group welcome omits daily merits paragraph when quota is zero', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
      dailyEmission: 0,
      welcomeMerits: 0,
    });
    expect(text).not.toContain('Каждый день вы получаете');
    expect(text).not.toContain('Новым участникам');
  });

  it('groupMiniAppLinkHint is set for follow-up message', () => {
    expect(TG_MSG.groupMiniAppLinkHint).toContain('кликните по ссылке ниже');
  });

  it('help lists commands after usage rules', () => {
    const text = buildTelegramHelpMessage('', {
      communityName: 'Test',
      hashtags: ['заслуга'],
    });
    expect(text).toContain('/balance — ваши заслуги');
    expect(text).toContain('/guide — подробный гайд');
    expect(text).toContain('/link — ссылка');
    expect(text).toContain(
      '1. Публикуйте посты с #заслуга, чтобы собирать заслуги для себя',
    );
    expect(text).toContain('2. Голосуйте за чужие посты с #заслуга реакциями');
    expect(text).toContain('3. Проверяйте баланс и историю');
    expect(text).toContain('4. Если нужен подробный гайд, отправьте команду /guide');
    expect(text).not.toContain('Голосование реакциями');
    expect(text).not.toContain('• Пример:');
    expect(text).not.toContain('Заслуги — внутренняя валюта');
  });

  it('help describes panel voting in step 2 when vote panel is enabled', () => {
    const text = buildTelegramHelpMessage('', {
      communityName: 'Test',
      hashtags: ['заслуга'],
      votePanelEnabled: true,
    });
    expect(text).toContain(
      '2. Голосуйте за чужие посты с #заслуга кнопками под постом (+1, своя сумма, против)',
    );
    expect(text).not.toContain('Голосование\n• +1');
    expect(text).not.toContain('Голосование реакциями');
    expect(text).not.toContain('счётчики показывают');
    expect(text).not.toContain('Или просто ответьте на пост');
  });

  it('group welcome uses panel step when vote panel is enabled', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
      votePanelEnabled: true,
    });
    expect(text).toContain(
      '2. Голосуйте за чужие посты с #заслуга кнопками под постом (+1, своя сумма, против)',
    );
    expect(text).not.toContain('2. Голосуйте за чужие посты с #заслуга реакциями');
    expect(text).not.toContain('счётчики');
  });

  it('settings summary lists editable fields without post ack toggle', () => {
    const text = buildSettingsLeadSummary({
      name: 'Клуб',
      hashtags: ['заслуга'],
      settings: { dailyEmission: 5, postCost: 1 },
      meritSettings: { startingMerits: 10 },
    });
    expect(text).toContain('«Клуб»');
    expect(text).toContain('5 заслуг в день');
    expect(text).toContain('#заслуга');
    expect(text).toContain('Подсказка без хэштега');
    expect(text).toContain('Панель голосования');
    expect(text).toContain('Отчёт о голосе');
    expect(text).toContain('/balance:');
    expect(text).not.toContain('Пост сохранён');
  });

  it('settingsUpdated reflects snapshot', () => {
    const snapshot = communitySettingsSnapshot({
      name: 'Клуб',
      hashtags: ['заслуга'],
      settings: { dailyEmission: 0, postCost: 2 },
      meritSettings: { startingMerits: 0 },
    });
    expect(TG_MSG.settingsUpdated(snapshot)).toContain('выключена');
    expect(TG_MSG.settingsUpdated(snapshot)).toContain('2 заслуг');
  });

  it('reactionPostNotFound uses community hashtag', () => {
    expect(TG_MSG.reactionPostNotFound('заслуга')).toContain('#заслуга');
    expect(TG_MSG.reactionPostNotFound('заслуга')).not.toContain('сохранённым');
  });

  it('group welcome mentions beneficiary post format in step 1', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
    });
    expect(text).toContain('«#заслуга для @username»');
    expect(text).toContain('ответьте на его сообщение');
  });

  it('voteSuccess includes voter name', () => {
    expect(TG_MSG.voteSuccess('Иван', 5, 'up')).toBe('Иван начислил автору 5 заслуг.');
    expect(TG_MSG.voteSuccess('Мария', 3, 'down')).toBe('Мария списал у автора 3 заслуг.');
    expect(
      TG_MSG.voteSuccess('Иван', 5, 'up', { credit: 'Петру', debit: 'Петра' }),
    ).toBe('Иван начислил Петру 5 заслуг.');
  });

  it('vote amount group prompt mentions voter at start', () => {
    const { text, entities } = buildVoteAmountGroupMentionMessage(900002, 'TG User', 'up');
    expect(text.startsWith('TG User,')).toBe(true);
    expect(entities[0]?.type).toBe('text_mention');
    expect(entities[0]?.user.id).toBe(900002);
  });

  it('vote amount numeric prompt asks for reply number', () => {
    const { text } = buildVoteAmountGroupNumericMentionMessage(900002, 'TG User', 'up', {
      wallet: 12,
      quota: 3,
    });
    expect(text).toContain('введите сумму заслуг ответом на это сообщение');
    expect(text).toContain('12 заслуг на кошельке и 3 ежедневных');
    expect(text).toContain('не больше 15');
  });

  it('vote amount balance hint for down uses wallet only', () => {
    expect(formatVoteAmountBalanceHint(10, 5, 'down')).toContain('не больше 10');
    expect(formatVoteAmountBalanceHint(10, 5, 'down')).not.toContain('ежедневных');
  });

  it('onboarding vote panel step mentions both modes', () => {
    const text = getOnboardingPrompt('onboarding_vote_panel', {});
    expect(text).toContain('Если да — участники голосуют кнопками');
    expect(text).toContain('Если нет — реакциями 👍❤️👎');
  });
});
