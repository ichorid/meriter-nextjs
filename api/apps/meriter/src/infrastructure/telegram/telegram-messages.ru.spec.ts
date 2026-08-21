import {
  buildGroupWelcomeMessage,
  buildNewMemberWelcomeMessage,
  buildMemberJoinStartPayload,
  buildMemberWelcomeLandingKeyboard,
  buildMemberWelcomeLandingMessage,
  parseMemberJoinStartPayload,
  resolveNewMemberGreetingName,
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
  mapTelegramUserFacingError,
  TG_BOT_OPEN_BUTTON_LABELS,
  TG_MSG,
  buildPollMiniAppUrl,
  buildPollOpenKeyboard,
  buildPollAnnouncementMessage,
  buildActivePollsListMessage,
  buildPollResultsMessage,
  formatPollDeadlineMsk,
  TG_POLL_OPEN_BUTTON_LABEL,
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
    expect(text).toContain('2. Если вы хотите собирать заслуги для другого пользователя');
    expect(text).toContain('\n\n3. Голосуйте за чужие посты с #заслуга реакциями');
    expect(text).toContain('\n\n4. Проверяйте баланс и историю');
    expect(text).not.toContain('Meriter подключён');
    expect(text).not.toContain('• Пример:');
  });

  it('group welcome uses custom hashtag from settings', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['предложение'],
    });
    expect(text).toContain('#предложение');
    expect(text).toContain('выберите участника из списка @ по имени');
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
      botUsername: 'meriter_bot',
      communityId: 'comm-1',
    });
    expect(text).toContain('Добро пожаловать в Meriter!');
    expect(text).toContain('/balance — ваши заслуги');
    expect(text).toContain('/guide — подробный гайд');
    expect(text).toContain('/link — ссылка');
    expect(text).toContain('/settings — настройки (только для администратора группы)');
    expect(text).toContain(
      '1. Публикуйте посты с #заслуга, чтобы собирать заслуги для себя.',
    );
    expect(text).toContain(
      '2. Если вы хотите собирать заслуги для другого пользователя',
    );
    expect(text).toContain('3. Голосуйте за чужие посты с #заслуга реакциями');
    expect(text).toContain('4. Проверяйте баланс и историю в мини-приложении: t.me/meriter_bot?startapp=comm-1');
    expect(text).toContain('5. Если нужен подробный гайд, отправьте команду /guide');
    expect(text).not.toContain('Голосование реакциями');
    expect(text).not.toContain('• Пример:');
    expect(text).not.toContain('Заслуги — внутренняя валюта');
  });

  it('help adds welcome grant line for /start new members', () => {
    const text = buildTelegramHelpMessage('', {
      hashtags: ['заслуга'],
      botUsername: 'meriter_bot',
      startWelcomeMerits: 10,
    });
    expect(text).toContain('Вам начислено 10 приветственных заслуг');
    expect(text).toContain('Дальше всё просто');
  });

  it('help describes panel voting in step 3 when vote panel is enabled', () => {
    const text = buildTelegramHelpMessage('', {
      communityName: 'Test',
      hashtags: ['заслуга'],
      votePanelEnabled: true,
    });
    expect(text).toContain(
      '3. Голосуйте за чужие посты с #заслуга кнопками, которые бот размещает под его постом',
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
      '3. Голосуйте за чужие посты с #заслуга кнопками, которые бот размещает под его постом',
    );
    expect(text).not.toContain('3. Голосуйте за чужие посты с #заслуга реакциями');
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

  it('buildNewMemberWelcomeMessage greets by first name without mention', () => {
    expect(resolveNewMemberGreetingName({ first_name: 'Мария', last_name: 'Архип' })).toBe('Мария');
    const text = buildNewMemberWelcomeMessage('Мария');
    expect(text).toBe(
      'Привет, Мария!\n\n' +
        'В этой группе работает бот Meriter — он ведёт учёт заслуг участников.\n\n' +
        'Чтобы начать, нажмите кнопку ниже. В открывшемся чате с ботом нажмите «Запустить» или напишите /start.',
    );
    expect(text).not.toContain('@');
  });

  it('parseMemberJoinStartPayload extracts community id', () => {
    expect(buildMemberJoinStartPayload('c8695af4240')).toBe('join_c8695af4240');
    expect(parseMemberJoinStartPayload('join_c8695af4240')).toBe('c8695af4240');
    expect(parseMemberJoinStartPayload('guide')).toBeNull();
  });

  it('buildMemberWelcomeLandingMessage emphasizes group chat and stats', () => {
    const text = buildMemberWelcomeLandingMessage({
      communityName: 'Клуб',
      hashtags: ['заслуга'],
      votePanelEnabled: true,
      isReturning: false,
      wallet: 10,
      quota: 5,
      quotaMax: 100,
      startWelcomeMerits: 10,
    });
    expect(text).toContain('групповом чате');
    expect(text).toContain('Баланс: 10 заслуг');
    expect(text).toContain('10 приветственных заслуг');
    expect(text).toContain('Команды (/balance');
  });

  it('buildMemberWelcomeLandingKeyboard includes return and mini-app urls', () => {
    const kb = buildMemberWelcomeLandingKeyboard({
      groupChatUrl: 'https://t.me/c/123',
      miniAppUrl: 't.me/bot?startapp=comm-1',
    });
    expect(kb?.inline_keyboard[0][0]).toEqual({
      text: TG_BOT_OPEN_BUTTON_LABELS.returnToGroupChat,
      url: 'https://t.me/c/123',
    });
    expect(kb?.inline_keyboard[1][0].url).toBe('https://t.me/bot?startapp=comm-1');
  });

  it('resolveNewMemberGreetingName falls back when first name is missing', () => {
    expect(resolveNewMemberGreetingName({ last_name: 'Архип' })).toBe('Архип');
    expect(resolveNewMemberGreetingName({})).toBe('друг');
  });

  it('settings summary lists new member welcome toggle', () => {
    const text = buildSettingsLeadSummary({
      name: 'Клуб',
      hashtags: ['заслуга'],
      settings: { dailyEmission: 5, postCost: 1, telegramNewMemberWelcomeEnabled: false },
      meritSettings: { startingMerits: 10 },
    });
    expect(text).toContain('Приветствие новых участников: выкл');
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

  it('group welcome mentions beneficiary post format in step 2', () => {
    const text = buildGroupWelcomeMessage({
      communityName: 'Test',
      hashtags: ['заслуга'],
    });
    expect(text).toContain('выберите участника из списка @ по имени');
    expect(text).toContain('ответьте на его сообщение');
  });

  it('voteSuccess includes voter name', () => {
    expect(TG_MSG.voteSuccess('Иван', 5, 'up')).toBe('Иван начислил автору 5 заслуг.');
    expect(TG_MSG.voteSuccess('Мария', 3, 'down')).toBe('Мария списал у автора 3 заслуги.');
    expect(TG_MSG.voteSuccess('Иван', 1, 'up')).toBe('Иван начислил автору 1 заслугу.');
    expect(TG_MSG.voteSuccess('Иван', 2, 'up')).toBe('Иван начислил автору 2 заслуги.');
    expect(TG_MSG.voteSuccess('Иван', 11, 'up')).toBe('Иван начислил автору 11 заслуг.');
    expect(TG_MSG.voteSuccess('Иван', 21, 'up')).toBe('Иван начислил автору 21 заслугу.');
    expect(
      TG_MSG.voteSuccess('Иван', 5, 'up', { credit: 'Петру', debit: 'Петра' }),
    ).toBe('Иван начислил Петру 5 заслуг.');
    expect(
      TG_MSG.voteSuccess('Карнаухова Юлия', 5, 'up', {
        credit: 'Дмитрий Соснин',
        debit: 'Дмитрия Соснина',
        nominator: 'Наталия',
      }),
    ).toBe(
      'Карнаухова Юлия начислил Дмитрий Соснин 5 заслуг (номинация от Наталия).',
    );
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

describe('telegram poll copy', () => {
  const expiresAt = new Date('2026-07-30T18:30:00Z');

  it('buildPollMiniAppUrl builds startapp=poll_ deep link (no colon)', () => {
    expect(buildPollMiniAppUrl('@meriter_bot', 'poll-1')).toBe(
      'https://t.me/meriter_bot?startapp=poll_poll-1',
    );
    expect(buildPollMiniAppUrl('meriter_bot', 'poll-1')).toBe(
      'https://t.me/meriter_bot?startapp=poll_poll-1',
    );
  });

  it('buildPollOpenKeyboard uses url button with «Открыть голосование» label', () => {
    const keyboard = buildPollOpenKeyboard('meriter_bot', 'poll-1');
    expect(keyboard.inline_keyboard[0][0]).toEqual({
      text: TG_POLL_OPEN_BUTTON_LABEL,
      url: 'https://t.me/meriter_bot?startapp=poll_poll-1',
    });
  });

  it('formatPollDeadlineMsk renders Moscow time with МСК suffix', () => {
    expect(formatPollDeadlineMsk(expiresAt)).toBe('30.07.2026 21:30 (МСК)');
  });

  it('announcement lists question, numbered options, and deadline', () => {
    const text = buildPollAnnouncementMessage({
      question: 'Куда едем летом?',
      options: [{ text: 'Море' }, { text: 'Горы' }],
      expiresAt,
    });
    expect(text).toContain('📊 Новое голосование');
    expect(text).toContain('Куда едем летом?');
    expect(text).toContain('1. Море');
    expect(text).toContain('2. Горы');
    expect(text).toContain('до 30.07.2026 21:30 (МСК)');
    expect(text).toContain('заслугами');
    expect(text).not.toContain('мерит');
  });

  it('active polls list shows deadlines, net totals, and deep links', () => {
    const text = buildActivePollsListMessage(
      'Команда',
      [
        {
          pollId: 'poll-1',
          question: 'Куда едем?',
          expiresAt,
          options: [
            { text: 'Море', amount: 7, amountUp: 8, amountDown: 1 },
            { text: 'Горы', amount: -2, amountUp: 1, amountDown: 3 },
          ],
        },
      ],
      'meriter_bot',
    );
    expect(text).toContain('Активные голосования в «Команда»:');
    expect(text).toContain('1. Куда едем?');
    expect(text).toContain('До 30.07.2026 21:30 (МСК)');
    expect(text).toContain('• Море: 7');
    expect(text).toContain('• Горы: -2');
    expect(text).toContain('Открыть: https://t.me/meriter_bot?startapp=poll_poll-1');
  });

  it('active polls list has an empty state', () => {
    expect(buildActivePollsListMessage('Команда', [], 'meriter_bot')).toBe(
      'В «Команда» сейчас нет активных голосований.',
    );
  });

  it('results message shows winner, per-option за/против, and participants', () => {
    const text = buildPollResultsMessage({
      question: 'Куда едем?',
      options: [
        { text: 'Море', amount: 7, amountUp: 8, amountDown: 1 },
        { text: 'Горы', amount: -2, amountUp: 1, amountDown: 3 },
      ],
      casterCount: 3,
      totalCasts: 5,
    });
    expect(text).toContain('📊 Голосование завершено');
    expect(text).toContain('Победитель: «Море» (7 заслуг)');
    expect(text).toContain('• Море: 7 (за 8, против 1)');
    expect(text).toContain('• Горы: -2 (за 1, против 3)');
    expect(text).toContain('Участников: 3 · голосов: 5');
    expect(text).not.toContain('мерит');
  });

  it('results message lists all tied winners', () => {
    const text = buildPollResultsMessage({
      question: 'Куда едем?',
      options: [
        { text: 'Море', amount: 5, amountUp: 5, amountDown: 0 },
        { text: 'Горы', amount: 5, amountUp: 6, amountDown: 1 },
        { text: 'Лес', amount: 2, amountUp: 2, amountDown: 0 },
      ],
      casterCount: 4,
      totalCasts: 6,
    });
    expect(text).toContain('Победители: «Море», «Горы» (по 5 заслуг)');
    expect(text).not.toContain('Победитель:');
  });

  it('results message omits winner line when nobody voted', () => {
    const text = buildPollResultsMessage({
      question: 'Куда едем?',
      options: [
        { text: 'Море', amount: 0, amountUp: 0, amountDown: 0 },
        { text: 'Горы', amount: 0, amountUp: 0, amountDown: 0 },
      ],
      casterCount: 0,
      totalCasts: 0,
    });
    expect(text).not.toContain('Победитель');
    expect(text).not.toContain('Победители');
    expect(text).toContain('Участников: 0 · голосов: 0');
  });
});

describe('mapTelegramUserFacingError', () => {
  it('maps permission errors without implying insufficient merits', () => {
    expect(mapTelegramUserFacingError('You do not have permission to vote on this publication')).toBe(
      'У вас нет прав для этого действия.',
    );
  });

  it('maps insufficient quota separately from wallet', () => {
    expect(mapTelegramUserFacingError('Insufficient quota. Available: 0, Requested: 1')).toContain(
      'квоты',
    );
  });

  it('does not map generic English errors to insufficient merits', () => {
    expect(mapTelegramUserFacingError('Something went wrong')).toBe(TG_MSG.actionFailedGeneric);
  });

  it('passes through Russian messages', () => {
    expect(mapTelegramUserFacingError('Уже голосовали')).toBe('Уже голосовали');
  });
});
