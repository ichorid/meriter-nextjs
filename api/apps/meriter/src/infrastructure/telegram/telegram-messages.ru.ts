/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

import type { TelegramBotPendingActionType } from '../../domain/models/telegram/telegram-bot-pending-action.schema';
import {
  formatOnboardingStepPrompt,
  type OnboardingFlowPayload,
} from './telegram-onboarding-flow';

export type CommunityUsageRulesInput = {
  communityName: string;
  hashtags?: string[];
  /** When false (default), no platform / browser / Mini App URLs in copy. */
  platformIntegration?: boolean;
  botUsername?: string;
  /** Daily quota for voting (0 = disabled). */
  dailyEmission?: number;
  /** Welcome merits credited to new members. */
  welcomeMerits?: number;
};

const ONBOARDING_STEP_BODIES: Partial<Record<TelegramBotPendingActionType, string>> = {
  onboarding_name:
    'Вы добавили бота Meriter в группу.\n\nКак называется ваше сообщество? Напишите название одним сообщением.',
  onboarding_platform_integration:
    'Интегрировать с платформой Meriter?\n\n' +
    'Если да — создастся сообщество на сайте, идеи из чата могут дублироваться туда.\n' +
    'Если нет — всё остаётся только в Telegram-чате (рекомендуется).',
  onboarding_platform_visibility:
    'Сообщество на платформе — приватное или публичное?\n\n' +
    '• Приватное — видят только участники (когда появится вход на сайт).\n' +
    '• Публичное — карточка сообщества может появиться в общей ленте Meriter.',
  onboarding_future_vision:
    'Кратко опишите, к чему стремится ваше сообщество — «образ будущего».\n\n' +
    'Хотя бы одно предложение. Текст будет виден на платформе Meriter.',
  onboarding_quota_enabled:
    'Выдавать участникам ежедневные заслуги?\n\nЭто помогает новичкам голосовать без накопленного баланса.',
  onboarding_quota_amount:
    'Сколько ежедневных заслуг в день? Напишите число, например: 5',
  onboarding_hashtag:
    'Какой хэштег для постов из чата? Напишите без #, например: идея\n\n' +
    'Участники будут писать #идея в сообщениях, чтобы опубликовать пост.',
  onboarding_post_cost:
    'Сколько заслуг стоит публикация поста? Напишите число.\n\n0 — публикация бесплатная.',
  onboarding_moderation:
    'Проверять посты лидом перед публикацией?\n\nЕсли да — посты появятся в группе только после одобрения.',
  onboarding_publication_ack:
    'Писать в группу «Пост сохранён», когда сообщение с хэштегом попало в Meriter?\n\nПо умолчанию лучше выключить.',
  onboarding_welcome_merits:
    'Сколько приветственных заслуг дать новому участнику?\n\n0 — не начислять. Напишите число.',
};

export function getOnboardingPrompt(
  action: TelegramBotPendingActionType,
  payload: OnboardingFlowPayload,
): string {
  const body = ONBOARDING_STEP_BODIES[action];
  if (!body) {
    throw new Error(`Missing onboarding copy for action "${action}"`);
  }
  return formatOnboardingStepPrompt(action, payload, body);
}

export function primaryCommunityHashtag(hashtags?: string[]): string {
  const tag = (hashtags?.[0] ?? 'идея').replace(/^#/, '').trim();
  return tag || 'идея';
}

function buildGroupWelcomeSteps(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  return (
    `1. Отправляйте сообщения с #${hashtag}, чтобы получать заслуги от других пользователей. ` +
    `Пример: «#${hashtag} Предлагаю собраться в субботу»\n` +
    `2. Голосуйте за такие сообщения реакциями 👍 ❤️ 👎\n` +
    `3. Проверяйте свой баланс и историю заслуг в нашем мини-приложении (ссылка ниже).`
  );
}

function buildHashtagAndMiniAppIntro(input: CommunityUsageRulesInput): string {
  return buildGroupWelcomeSteps(input);
}

function buildReactionVotingRules(): string {
  return (
    `Голосование реакциями:\n` +
    `• 👍 — поддержать быстро +1 заслуга автору\n` +
    `• ❤️ — поддержать сильнее (выберите сумму кнопкой)\n` +
    `• 👎 — не согласен (списание с вашего кошелька, выберите сумму)`
  );
}

function buildReplyVoteHint(): string {
  return `Или просто ответьте на пост в таком формате: «+3 Отличная идея» или «-2 Не согласен».`;
}

function buildDailyMeritsParagraph(dailyEmission: number): string {
  if (dailyEmission <= 0) {
    return '';
  }
  return (
    `\n\nКаждый день — ${dailyEmission} заслуг на голоса: они сгорают в полночь. ` +
    `Сначала тратятся они, потом кошелёк — заслуги от других за ваши посты.`
  );
}

function buildWelcomeMeritsParagraph(welcomeMerits?: number): string {
  if (welcomeMerits == null || welcomeMerits <= 0) {
    return '';
  }
  return `\n\nНовым участникам — ${welcomeMerits} приветственных заслуг.`;
}

function buildCommunityUsageBody(input: CommunityUsageRulesInput): string {
  return (
    `${buildHashtagAndMiniAppIntro(input)}\n\n` +
    `${buildReactionVotingRules()}\n\n` +
    buildReplyVoteHint()
  );
}

export function buildCommunityUsageRules(input: CommunityUsageRulesInput): string {
  return buildCommunityUsageBody(input);
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

export function buildTelegramMiniAppStartLink(
  botUsername: string,
  communityId?: string,
): string {
  const clean = botUsername.replace(/^@/, '').trim();
  const id = communityId?.trim();
  if (id) {
    return `t.me/${clean}?startapp=${encodeURIComponent(id)}`;
  }
  return `t.me/${clean}?startapp`;
}

export function buildGroupWelcomeMessage(input: CommunityUsageRulesInput): string {
  const dailyEmission = input.dailyEmission ?? 0;
  return (
    `Привет!\n\n` +
    `Я – Меритер: бот, который поможет вам учитывать заслуги всех участников этой группы.\n\n` +
    buildGroupWelcomeSteps(input) +
    buildDailyMeritsParagraph(dailyEmission) +
    buildWelcomeMeritsParagraph(input.welcomeMerits)
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
  const rulesBlock = `${buildCommunityUsageRules({
    communityName: options?.communityName ?? 'сообщество',
    hashtags: options?.hashtags,
    platformIntegration: options?.platformIntegration,
    botUsername: options?.botUsername,
  })}\n\n`;

  return (
    `${rulesBlock}` +
    `Команды в чате:\n` +
    `/balance — ваши заслуги\n` +
    `/members — список участников\n` +
    `/settings — настройки (лид)\n` +
    `/help — эта подсказка`
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
  cannotVoteOwnPost: 'Голосовать за собственный пост нельзя.',
  voteAmountGroupPrompt:
    'Насколько заслуг начислить автору?\n\nВыберите сумму кнопкой или ответьте числом на это сообщение.',
  voteAmountGroupPromptDown:
    'Насколько заслуг списать с автора?\n\nВыберите сумму кнопкой или ответьте числом на это сообщение.',
  balanceSelf: (name: string, wallet: number, quota: number, quotaMax: number, pct: number) =>
    `Ваши заслуги в «${name}»\n\n` +
    `Кошелёк — накопленные заслуги: ${wallet}\n` +
    `Ежедневные заслуги на сегодня: ${quota} из ${quotaMax}\n` +
    `Доля в общем фонде сообщества: ${pct.toFixed(1)}%`,
  membersHeader: 'Участники сообщества:',
  memberLine: (display: string, wallet: number, pct: number) =>
    `• ${display}: ${wallet} (${pct.toFixed(1)}%)`,
  onboardingFutureVisionEmpty:
    'Нужен хотя бы один осмысленный абзац. Опишите цели и ценности сообщества.',
  onboardingFutureVisionTooLong: (max: number) =>
    `Слишком длинный текст. Сократите до ${max} символов и отправьте снова.`,
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество на паузе — начисления и траты заслуг остановлены. Добавьте бота обратно.',
  groupMiniAppLinkHint:
    'Чтобы открыть интерфейс Meriter, проверить свой баланс и заслуги других участников, кликните по ссылке ниже:',
  enterAmount: 'Напишите число — сколько заслуг начислить автору:',
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

export function voteAmountButtonLabels(_direction: 'up' | 'down'): [string, string, string] {
  return ['1', '3', '5'];
}
