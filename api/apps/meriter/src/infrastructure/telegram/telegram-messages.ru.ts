/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

export type CommunityUsageRulesInput = {
  communityName: string;
  hashtags?: string[];
  /** When false (default), no platform / browser / Mini App URLs in copy. */
  platformIntegration?: boolean;
  botUsername?: string;
};

export const ONBOARDING_TOTAL_STEPS = 11;

export function onboardingStepPrompt(step: number, text: string): string {
  return `Шаг ${step} из ${ONBOARDING_TOTAL_STEPS}\n\n${text}`;
}

export function primaryCommunityHashtag(hashtags?: string[]): string {
  const tag = (hashtags?.[0] ?? 'идея').replace(/^#/, '').trim();
  return tag || 'идея';
}

export function buildMiniAppOpenSteps(botUsername?: string): string {
  if (botUsername) {
    return (
      `Как открыть приложение Meriter:\n` +
      `1) В группе откройте меню бота (кнопка «Meriter» внизу или в профиле бота)\n` +
      `2) Или перейдите: https://t.me/${botUsername}?startapp\n` +
      `3) В приложении: баланс, участники, история заслуг`
    );
  }
  return (
    `Как открыть приложение Meriter:\n` +
    `1) Откройте бота в Telegram\n` +
    `2) Нажмите кнопку «Meriter» в меню бота\n` +
    `3) В приложении: баланс, участники, история заслуг`
  );
}

export function buildCommunityUsageRules(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  const miniAppBlock =
    input.platformIntegration !== false
      ? `${buildMiniAppOpenSteps(input.botUsername)}\n\n`
      : '';
  return (
    `${miniAppBlock}` +
    `Публикация в чате: напишите #${hashtag} в тексте сообщения.\n` +
    `Пример: «#${hashtag} Предлагаю собраться в субботу»\n\n` +
    `Голосование реакциями:\n` +
    `• 👍 — быстро +1 заслуга автору\n` +
    `• ❤️ — поддержать сильнее (выберите сумму кнопкой)\n` +
    `• 👎 — не согласен (списание с вашего кошелька, выберите сумму)\n\n` +
    `Или ответьте на пост: +3 Отличная идея  /  -2 Не согласен\n\n` +
    `Заслуги — внутренняя валюта сообщества, не деньги.`
  );
}

export function buildOnboardingDoneMessage(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  const openHint =
    input.platformIntegration !== false
      ? `• Откройте приложение Meriter и посмотрите баланс\n`
      : '';
  return (
    `Готово! Сообщество «${input.communityName}» настроено.\n\n` +
    `Что делать дальше:\n` +
    openHint +
    `• Опубликуйте первый пост с #${hashtag} в группе\n\n` +
    buildCommunityUsageRules(input)
  );
}

export function buildGroupWelcomeMessage(input: CommunityUsageRulesInput): string {
  const openHint =
    input.platformIntegration !== false
      ? `Откройте приложение Meriter — там баланс и участники.\n`
      : '';
  return (
    `Meriter подключён к «${input.communityName}».\n\n` +
    openHint +
    `Голосуйте реакциями 👍 ❤️ 👎 на посты бота и сообщения с хэштегом.\n\n` +
    buildCommunityUsageRules(input)
  );
}

export function communityWebPostMiniAppUrl(
  _baseUrl: string,
  _communityId: string,
  postId: string,
  botUsername: string,
): string {
  return `https://t.me/${botUsername}?startapp=post:${postId}`;
}

export function buildTelegramHelpMessage(
  _communityWebBaseUrl: string,
  options?: {
    communityId?: string;
    communityName?: string;
    hashtags?: string[];
    botUsername?: string;
    platformIntegration?: boolean;
  },
): string {
  const rulesBlock = options?.communityName
    ? `${buildCommunityUsageRules({
        communityName: options.communityName,
        hashtags: options?.hashtags,
        platformIntegration: options?.platformIntegration,
        botUsername: options?.botUsername,
      })}\n\n`
    : `${buildCommunityUsageRules({
        communityName: 'сообщество',
        hashtags: options?.hashtags,
        platformIntegration: options?.platformIntegration,
        botUsername: options?.botUsername,
      })}\n\n`;

  const appLine =
    options?.botUsername && options?.platformIntegration !== false
      ? `\n\nПриложение: https://t.me/${options.botUsername}?startapp`
      : '';

  return (
    `${rulesBlock}` +
    `Команды в чате:\n` +
    `/balance — ваши заслуги\n` +
    `/members — список участников\n` +
    `/settings — настройки (лид)\n` +
    `/help — эта подсказка` +
    appLine
  );
}

/** Map backend errors to plain Russian for chat users. */
export function mapTelegramUserFacingError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('insufficient') ||
    lower.includes('not enough') ||
    lower.includes('не хватает')
  ) {
    return TG_MSG.insufficientMerits;
  }
  if (lower.includes('frozen') || lower.includes('заморож')) {
    return TG_MSG.frozenMember;
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('доступ')) {
    return 'У вас нет прав для этого действия.';
  }
  if (/^[a-z\s_-]+$/i.test(message.trim()) && message.length < 120) {
    return TG_MSG.insufficientMerits;
  }
  if (/[\u0400-\u04FF]/.test(message)) {
    return message;
  }
  return TG_MSG.insufficientMerits;
}

export const TG_VOTE_DEFAULT_COMMENT = 'В Telegram-группе';

export const TG_MSG = {
  frozenMember:
    'Доступ к заслугам приостановлен — вы не состоите в Telegram-группе. Вернитесь в группу.',
  communityFrozen:
    'Сообщество на паузе: бот удалён из группы. Заслуги временно недоступны. Добавьте бота обратно.',
  insufficientMerits: 'Не хватает заслуг для этого действия. Проверьте баланс командой /balance.',
  voteSuccess: (amount: number, direction: 'up' | 'down') =>
    direction === 'up'
      ? `Начислено ${amount} заслуг автору.`
      : `Списано ${amount} заслуг с автора.`,
  reactionPostNotFound:
    'Это сообщение ещё не в Meriter. Голосовать можно только по сохранённым постам (с хэштегом или от бота).',
  reactionUnsupported:
    'Такая реакция не поддерживается.\n\n' +
    'Используйте 👍 ❤️ 👎 или ответьте на пост: +3 ваш комментарий',
  voteAmountGroupPrompt:
    'Сколько заслуг начислить автору?\n\nОтветьте числом на это сообщение или нажмите кнопку ниже.',
  voteAmountGroupPromptSelf:
    'Сколько заслуг начислить?\n\nНа свой пост — только с кошелька.\nОтветьте числом или нажмите кнопку.',
  voteAmountGroupPromptDown:
    'Сколько заслуг списать с автора?\n\nОтветьте числом на это сообщение или нажмите кнопку ниже.',
  balanceSelf: (name: string, wallet: number, quota: number, quotaMax: number, pct: number) =>
    `Ваши заслуги в «${name}»\n\n` +
    `Кошелёк — накопленные заслуги: ${wallet}\n` +
    `Ежедневные заслуги на сегодня: ${quota} из ${quotaMax}\n` +
    `Доля в общем фонде сообщества: ${pct.toFixed(1)}%`,
  membersHeader: 'Участники сообщества:',
  memberLine: (display: string, wallet: number, pct: number) =>
    `• ${display}: ${wallet} (${pct.toFixed(1)}%)`,
  onboardingStart: onboardingStepPrompt(
    1,
    'Вы добавили бота Meriter в группу.\n\nКак называется ваше сообщество? Напишите название одним сообщением.',
  ),
  onboardingPlatformIntegration: onboardingStepPrompt(
    2,
    'Интегрировать с платформой Meriter?\n\n' +
      'Если да — создастся сообщество на сайте, идеи из чата могут дублироваться туда.\n' +
      'Если нет — всё остаётся только в Telegram-чате (рекомендуется).',
  ),
  onboardingPlatformVisibility: onboardingStepPrompt(
    3,
    'Сообщество на платформе — приватное или публичное?\n\n' +
      '• Приватное — видят только участники (когда появится вход на сайт).\n' +
      '• Публичное — карточка сообщества может появиться в общей ленте Meriter.',
  ),
  onboardingFutureVision: onboardingStepPrompt(
    4,
    'Кратко опишите, к чему стремится ваше сообщество — «образ будущего».\n\n' +
      'Хотя бы одно предложение. Текст будет виден на платформе Meriter.',
  ),
  onboardingFutureVisionEmpty:
    'Нужен хотя бы один осмысленный абзац. Опишите цели и ценности сообщества.',
  onboardingFutureVisionTooLong: (max: number) =>
    `Слишком длинный текст. Сократите до ${max} символов и отправьте снова.`,
  onboardingQuota: onboardingStepPrompt(
    5,
    'Выдавать участникам ежедневные заслуги?\n\nЭто помогает новичкам голосовать без накопленного баланса.',
  ),
  onboardingQuotaAmount: onboardingStepPrompt(
    6,
    'Сколько ежедневных заслуг в день? Напишите число, например: 5',
  ),
  onboardingHashtag: onboardingStepPrompt(
    7,
    'Какой хэштег для постов из чата? Напишите без #, например: идея\n\n' +
      'Участники будут писать #идея в сообщениях, чтобы опубликовать пост.',
  ),
  onboardingPostCost: onboardingStepPrompt(
    8,
    'Сколько заслуг стоит публикация поста? Напишите число.\n\n0 — публикация бесплатная.',
  ),
  onboardingModeration: onboardingStepPrompt(
    9,
    'Проверять посты лидом перед публикацией?\n\nЕсли да — посты появятся в группе только после одобрения.',
  ),
  onboardingPublicationAck: onboardingStepPrompt(
    10,
    'Писать в группу «Пост сохранён», когда сообщение с хэштегом попало в Meriter?\n\nПо умолчанию лучше выключить.',
  ),
  onboardingWelcome: onboardingStepPrompt(
    11,
    'Сколько приветственных заслуг дать новому участнику?\n\n0 — не начислять. Напишите число.',
  ),
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество на паузе — начисления и траты заслуг остановлены. Добавьте бота обратно.',
  enterAmount: 'Напишите число — сколько заслуг начислить:',
  enterAmountSelfUp:
    'Напишите число заслуг. На свой пост можно только с кошелька (не с ежедневных на сегодня).',
  voteAmountDmFailed: (botUsername: string) =>
    `Не удалось написать вам в личку.\n\n` +
    `1) Откройте @${botUsername}\n` +
    `2) Нажмите Start / Запустить\n` +
    `3) Повторите реакцию в группе`,
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. Напишите /help — там все подсказки.',
  noLinkedCommunity:
    'Сообщество ещё не настроено.\n\n' +
    '1) Добавьте бота в группу\n' +
    '2) Завершите мастер настройки в личке с ботом (тому, кто добавил бота)',
  groupNotLinked:
    'Бот не привязан к этой группе.\n\nТому, кто добавил бота, нужно завершить настройку в личке с @ботом.',
  onboardingInProgress:
    'Настройка не завершена. Продолжите ответы в личке с ботом — бот задаст следующий вопрос.',
  multipleLinkedCommunities:
    'У вас несколько сообществ Meriter. Используйте команды в той группе, где хотите действовать.',
  settingsLeadOnly: 'Настройки бота доступны только лиду сообщества.',
  settingsUseGroup: 'Настройки бота: напишите /settings в группе (только лид).',
  settingsLead: (ackEnabled: boolean) =>
    `Настройки Meriter\n\n` +
    `Сообщение «Пост сохранён» в группе: ${ackEnabled ? 'включено' : 'выключено'}.`,
  settingsAckUpdated: (enabled: boolean) =>
    enabled
      ? 'Уведомления о сохранении постов включены.'
      : 'Уведомления о сохранении постов выключены.',
  postSavedAck: 'Пост сохранён.',
} as const;

export const TG_EMOJI = {
  up: '👍',
  upAlt: '👍🏻',
  heart: '❤',
  heartFull: '❤️',
  down: '👎',
} as const;

export function voteAmountButtonLabels(direction: 'up' | 'down'): [string, string, string] {
  if (direction === 'down') {
    return ['-1', '-3', '-5'];
  }
  return ['+1', '+3', '+5'];
}
