/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

import type { TelegramWebLinkStyle } from '../../common/helpers/product-mode.helper';

export type CommunityUsageRulesInput = {
  communityName: string;
  hashtags?: string[];
};

export const ONBOARDING_TOTAL_STEPS = 9;

export function onboardingStepPrompt(step: number, text: string): string {
  return `Шаг ${step} из ${ONBOARDING_TOTAL_STEPS}\n\n${text}`;
}

export function primaryCommunityHashtag(hashtags?: string[]): string {
  const tag = (hashtags?.[0] ?? 'идея').replace(/^#/, '').trim();
  return tag || 'идея';
}

export function buildMiniAppOpenSteps(): string {
  return (
    `Как открыть приложение Meriter:\n` +
    `1) В группе нажмите 📎 (скрепка) слева от поля ввода\n` +
    `2) Выберите «Meriter» в меню\n` +
    `3) Откроется приложение: баланс, люди, переводы, лента`
  );
}

export function buildCommunityUsageRules(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  return (
    `${buildMiniAppOpenSteps()}\n\n` +
    `Публикация в чате: напишите #${hashtag} в тексте сообщения.\n` +
    `Пример: «#${hashtag} Предлагаю собраться в субботу»\n\n` +
    `Голосование реакциями:\n` +
    `• 👍 — быстро +1 заслуга автору\n` +
    `• ❤️ — поддержать сильнее (выберите сумму кнопкой)\n` +
    `• 🤡 — не согласен (списание с вашего кошелька, выберите сумму)\n\n` +
    `Или ответьте на пост: +3 Отличная идея  /  -2 Не согласен\n\n` +
    `Заслуги — внутренняя валюта сообщества, не деньги.`
  );
}

export function buildOnboardingDoneMessage(input: CommunityUsageRulesInput): string {
  return (
    `Готово! Сообщество «${input.communityName}» настроено.\n\n` +
    `Что делать дальше:\n` +
    `• Откройте Meriter у 📎 и посмотрите баланс\n` +
    `• Опубликуйте первый пост с #${primaryCommunityHashtag(input.hashtags)} в группе\n\n` +
    buildCommunityUsageRules(input)
  );
}

export function buildGroupWelcomeMessage(input: CommunityUsageRulesInput): string {
  return (
    `Meriter подключён к «${input.communityName}».\n\n` +
    `Начните с приложения у 📎 — там баланс, участники и переводы.\n` +
    `Голосуйте реакциями 👍 ❤️ 🤡 на посты бота и сообщения с хэштегом.\n\n` +
    buildCommunityUsageRules(input)
  );
}

export function communityWebMiniAppUrl(
  baseUrl: string,
  _linkStyle: TelegramWebLinkStyle = 'community-web',
): string {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/tg`;
}

export function communityWebPostMiniAppUrl(
  _baseUrl: string,
  _communityId: string,
  postId: string,
  botUsername: string,
): string {
  return `https://t.me/${botUsername}?startapp=post:${postId}`;
}

export function communityWebFeedUrl(
  baseUrl: string,
  communityId: string,
  linkStyle: TelegramWebLinkStyle = 'community-web',
): string {
  const root = baseUrl.replace(/\/$/, '');
  if (linkStyle === 'meriter-web') {
    return `${root}/meriter/communities/${communityId}`;
  }
  return `${root}/c/${communityId}/feed`;
}

export function communityWebLoginUrl(
  baseUrl: string,
  linkStyle: TelegramWebLinkStyle = 'community-web',
): string {
  const root = baseUrl.replace(/\/$/, '');
  if (linkStyle === 'meriter-web') {
    return `${root}/meriter/login`;
  }
  return `${root}/login`;
}

export function buildTelegramHelpMessage(
  communityWebBaseUrl: string,
  options?: {
    communityId?: string;
    communityName?: string;
    hashtags?: string[];
    linkStyle?: TelegramWebLinkStyle;
  },
): string {
  const linkStyle = options?.linkStyle ?? 'community-web';
  const miniAppUrl = communityWebMiniAppUrl(communityWebBaseUrl, linkStyle);
  const openLine = options?.communityId
    ? `\n\nПриложение: ${miniAppUrl}\nВеб-версия: ${communityWebFeedUrl(communityWebBaseUrl, options.communityId, linkStyle)}`
    : `\n\nПриложение: ${miniAppUrl}\nВход в браузере: ${communityWebLoginUrl(communityWebBaseUrl, linkStyle)}`;

  const rulesBlock = options?.communityName
    ? `${buildCommunityUsageRules({
        communityName: options.communityName,
        hashtags: options?.hashtags,
      })}\n\n`
    : `${buildCommunityUsageRules({ communityName: 'сообщество', hashtags: options?.hashtags })}\n\n`;

  return (
    `${rulesBlock}` +
    `Команды в чате (если нет приложения):\n` +
    `/баланс или /balance — ваши заслуги\n` +
    `/участники или /members — список участников\n` +
    `/перевод или /transfer — перевести заслуги\n` +
    `/настройки или /settings — настройки (лид)\n` +
    `/справка или /help — эта подсказка` +
    openLine
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
    'Доступ к заслугам приостановлен — вы не состоите в Telegram-группе. Вернитесь в группу и откройте Meriter снова.',
  communityFrozen:
    'Сообщество на паузе: бот удалён из группы. Заслуги временно недоступны. Добавьте бота обратно.',
  insufficientMerits: 'Не хватает заслуг для этого действия. Проверьте баланс в приложении Meriter (📎).',
  transferDoneGroup: (amount: number, receiverName: string, balance: number) =>
    `Готово! Переведено ${amount} заслуг → ${receiverName}.\nВаш баланс: ${balance}.`,
  transferUseGroup:
    'Перевод заслуг работает только в группе.\n\n' +
    '• Ответьте на сообщение участника: /перевод 5\n' +
    '• Или укажите имя: /перевод @username 5',
  transferErrorSelf: 'Нельзя переводить заслуги самому себе.',
  transferErrorAmount: 'Укажите положительное число заслуг.',
  transferErrorReceiver:
    'Участник не найден. Убедитесь, что он писал в группе и состоит в Meriter.',
  transferErrorFormat:
    'Не получилось разобрать команду.\n\n' +
    'Примеры:\n' +
    '• /перевод @ivan 5\n' +
    '• ответ на сообщение: /перевод 5',
  voteSuccess: (amount: number, direction: 'up' | 'down') =>
    direction === 'up'
      ? `Начислено ${amount} заслуг автору.`
      : `Списано ${amount} заслуг с автора.`,
  reactionPostNotFound:
    'Это сообщение ещё не в Meriter. Голосовать можно только по сохранённым постам (с хэштегом или от бота).',
  reactionUnsupported:
    'Такая реакция не поддерживается.\n\n' +
    'Используйте 👍 ❤️ 🤡 или ответьте на пост: +3 ваш комментарий',
  voteAmountGroupPrompt:
    'Сколько заслуг начислить автору?\n\nОтветьте числом на это сообщение или нажмите кнопку ниже.',
  voteAmountGroupPromptSelf:
    'Сколько заслуг начислить?\n\nНа свой пост — только с кошелька.\nОтветьте числом или нажмите кнопку.',
  voteAmountGroupPromptDown:
    'Сколько заслуг списать с автора?\n\nОтветьте числом на это сообщение или нажмите кнопку ниже.',
  balanceSelf: (name: string, wallet: number, quota: number, quotaMax: number, pct: number) =>
    `Ваши заслуги в «${name}»\n\n` +
    `Кошелёк — накопленные заслуги: ${wallet}\n` +
    `Бесплатные на сегодня: ${quota} из ${quotaMax}\n` +
    `Доля в общем фонде сообщества: ${pct.toFixed(1)}%`,
  membersHeader: 'Участники сообщества:',
  memberLine: (display: string, wallet: number, pct: number) =>
    `• ${display}: ${wallet} (${pct.toFixed(1)}%)`,
  onboardingStart: onboardingStepPrompt(
    1,
    'Вы добавили бота Meriter в группу.\n\nКак называется ваше сообщество? Напишите название одним сообщением.',
  ),
  onboardingFutureVision: onboardingStepPrompt(
    2,
    'Кратко опишите, к чему стремится ваше сообщество — «образ будущего».\n\n' +
      'Это обязательный шаг: хотя бы одно предложение. Текст сохранится в Meriter.',
  ),
  onboardingFutureVisionEmpty:
    'Нужен хотя бы один осмысленный абзац. Опишите цели и ценности сообщества.',
  onboardingFutureVisionTooLong: (max: number) =>
    `Слишком длинный текст. Сократите до ${max} символов и отправьте снова.`,
  onboardingQuota: onboardingStepPrompt(
    3,
    'Выдавать участникам бесплатные заслуги каждый день?\n\nЭто помогает новичкам голосовать без накопленного баланса.',
  ),
  onboardingQuotaAmount: onboardingStepPrompt(
    4,
    'Сколько бесплатных заслуг в день? Напишите число, например: 5',
  ),
  onboardingHashtag: onboardingStepPrompt(
    5,
    'Какой хэштег для постов из чата? Напишите без #, например: идея\n\n' +
      'Участники будут писать #идея в сообщениях, чтобы опубликовать пост.',
  ),
  onboardingPostCost: onboardingStepPrompt(
    6,
    'Сколько заслуг стоит публикация поста? Напишите число.\n\n0 — публикация бесплатная.',
  ),
  onboardingModeration: onboardingStepPrompt(
    7,
    'Проверять посты лидом перед публикацией?\n\nЕсли да — посты появятся в группе только после одобрения.',
  ),
  onboardingPublicationAck: onboardingStepPrompt(
    8,
    'Писать в группу «Пост сохранён», когда сообщение с хэштегом попало в Meriter?\n\nПо умолчанию лучше выключить.',
  ),
  onboardingWelcome: onboardingStepPrompt(
    9,
    'Сколько приветственных заслуг дать новому участнику?\n\n0 — не начислять. Напишите число.',
  ),
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество на паузе — начисления и траты заслуг остановлены. Добавьте бота обратно.',
  enterAmount: 'Напишите число — сколько заслуг начислить:',
  enterAmountSelfUp:
    'Напишите число заслуг. На свой пост можно только с кошелька (не с бесплатных на сегодня).',
  voteAmountDmFailed: (botUsername: string) =>
    `Не удалось написать вам в личку.\n\n` +
    `1) Откройте @${botUsername}\n` +
    `2) Нажмите Start / Запустить\n` +
    `3) Повторите реакцию в группе`,
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. Напишите /справка или /help — там все подсказки.',
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
  settingsUseGroup: 'Настройки бота: напишите /settings или /настройки в группе (только лид).',
  settingsLead: (ackEnabled: boolean) =>
    `Настройки Meriter\n\n` +
    `Сообщение «Пост сохранён» в группе: ${ackEnabled ? 'включено' : 'выключено'}.`,
  settingsAckUpdated: (enabled: boolean) =>
    enabled
      ? 'Уведомления о сохранении постов включены.'
      : 'Уведомления о сохранении постов выключены.',
  postSavedAck: 'Пост сохранён в Meriter.',
} as const;

export const TG_EMOJI = {
  up: '👍',
  upAlt: '👍🏻',
  heart: '❤',
  heartFull: '❤️',
  down: '🤡',
} as const;

export function voteAmountButtonLabels(direction: 'up' | 'down'): [string, string, string] {
  if (direction === 'down') {
    return ['-1', '-3', '-5'];
  }
  return ['+1', '+3', '+5'];
}
