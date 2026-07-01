/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

import type { TelegramBotPendingActionType } from '../../domain/models/telegram/telegram-bot-pending-action.schema';
import {
  formatOnboardingStepPrompt,
  type OnboardingFlowPayload,
} from './telegram-onboarding-flow';
import {
  formatTelegramCommandDeliveryLabel,
  resolveTelegramCommandDelivery,
  type TelegramCommandRoutingSettings,
  type TelegramRoutableCommand,
} from './telegram-command-routing';

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
  /** When true, voting uses persistent button panel under posts. */
  votePanelEnabled?: boolean;
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
    'Какой хэштег для постов из чата? Напишите без #, например: заслуга\n\n' +
    'Участники будут писать #заслуга в сообщениях, чтобы опубликовать пост.',
  onboarding_post_cost:
    'Сколько заслуг стоит публикация поста? Напишите число.\n\n0 — публикация бесплатная.',
  onboarding_moderation:
    'Проверять посты лидом перед публикацией?\n\nЕсли да — посты появятся в группе только после одобрения.',
  onboarding_publication_ack:
    'Писать в группу «Пост сохранён», когда сообщение с хэштегом попало в Meriter?\n\nПо умолчанию лучше выключить.',
  onboarding_welcome_merits:
    'Сколько приветственных заслуг дать новому участнику?\n\n0 — не начислять. Напишите число.',
  onboarding_vote_panel:
    'Показывать под постами кнопки начисления заслуг со счётчиками?\n\n' +
    'Если да — участники голосуют кнопками (+1, своя сумма, против).\n' +
    'Если нет — реакциями 👍❤️👎',
  onboarding_command_delivery:
    'Куда отвечать на /balance, /members, /help и /link?\n\n' +
    '1 — в группу, сообщение исчезает через минуту (по умолчанию)\n' +
    '2 — в группу, остаётся в чате\n' +
    '3 — в личку с ботом',
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
  const tag = (hashtags?.[0] ?? 'заслуга').replace(/^#/, '').trim();
  return tag || 'заслуга';
}

export type CommunitySettingsSnapshotInput = {
  name: string;
  hashtags?: string[];
  settings?: {
    dailyEmission?: number;
    postCost?: number;
    telegramReactionNoHashtagHintEnabled?: boolean;
    telegramVotePanelEnabled?: boolean;
    telegramCommandRouting?: TelegramCommandRoutingSettings;
  };
  meritSettings?: { startingMerits?: number };
};

export function communitySettingsSnapshot(
  community: CommunitySettingsSnapshotInput,
): {
  name: string;
  dailyEmission: number;
  postCost: number;
  hashtag: string;
  welcomeMerits: number;
} {
  return {
    name: community.name,
    dailyEmission: community.settings?.dailyEmission ?? 0,
    postCost: community.settings?.postCost ?? 0,
    hashtag: primaryCommunityHashtag(community.hashtags),
    welcomeMerits: community.meritSettings?.startingMerits ?? 0,
  };
}

const SETTINGS_EDIT_PROMPTS: Partial<Record<TelegramBotPendingActionType, string>> = {
  settings_edit_name: 'Новое название сообщества? Напишите одним сообщением.',
  settings_edit_quota:
    'Сколько ежедневных заслуг выдавать участникам? Напишите число.\n\n0 — отключить ежедневную квоту.',
  settings_edit_post_cost:
    'Сколько заслуг стоит публикация поста? Напишите число.\n\n0 — публикация бесплатная.',
  settings_edit_hashtag:
    'Какой хэштег для постов из чата? Напишите без #, например: заслуга',
  settings_edit_welcome_merits:
    'Сколько приветственных заслуг дать новому участнику?\n\n0 — не начислять. Напишите число.',
};

export function getSettingsEditPrompt(action: TelegramBotPendingActionType): string {
  const body = SETTINGS_EDIT_PROMPTS[action];
  if (!body) {
    throw new Error(`Missing settings edit copy for action "${action}"`);
  }
  return body;
}

export function buildSettingsLeadSummary(community: CommunitySettingsSnapshotInput): string {
  const s = communitySettingsSnapshot(community);
  const quotaLine =
    s.dailyEmission > 0
      ? `${s.dailyEmission} заслуг в день`
      : 'выключена';
  const noHashtagHint =
    community.settings?.telegramReactionNoHashtagHintEnabled !== false ? 'вкл' : 'выкл';
  const votePanel =
    community.settings?.telegramVotePanelEnabled === true ? 'вкл' : 'выкл';
  const routing = community.settings?.telegramCommandRouting;
  const routeLines = (['balance', 'members', 'help', 'link'] as TelegramRoutableCommand[])
    .map((cmd) => {
      const d = resolveTelegramCommandDelivery(routing, cmd);
      return `• ${formatTelegramCommandDeliveryLabel(cmd, d)}`;
    })
    .join('\n');
  return (
    `Настройки Meriter\n\n` +
    `• Название: «${s.name}»\n` +
    `• Ежедневная квота: ${quotaLine}\n` +
    `• Стоимость поста: ${s.postCost} заслуг\n` +
    `• Хэштег: #${s.hashtag}\n` +
    `• Приветственные заслуги: ${s.welcomeMerits}\n` +
    `• Подсказка без хэштега: ${noHashtagHint}\n` +
    `• Панель голосования: ${votePanel}\n` +
    `${routeLines}\n\n` +
    `Нажмите кнопку — бот задаст вопрос в личке или переключит режим.`
  );
}

export type SettingsEditField = 'name' | 'quota' | 'post_cost' | 'hashtag' | 'welcome';

export function settingsEditFieldToAction(field: SettingsEditField): TelegramBotPendingActionType {
  const map: Record<SettingsEditField, TelegramBotPendingActionType> = {
    name: 'settings_edit_name',
    quota: 'settings_edit_quota',
    post_cost: 'settings_edit_post_cost',
    hashtag: 'settings_edit_hashtag',
    welcome: 'settings_edit_welcome_merits',
  };
  return map[field];
}

const SETTINGS_EDIT_FIELDS = new Set<SettingsEditField>([
  'name',
  'quota',
  'post_cost',
  'hashtag',
  'welcome',
]);

export function isSettingsEditField(field: string): field is SettingsEditField {
  return SETTINGS_EDIT_FIELDS.has(field as SettingsEditField);
}

export function buildSettingsEditKeyboard(
  communityId: string,
  options: {
    reactionNoHashtagHintEnabled?: boolean;
    votePanelEnabled?: boolean;
    commandRouting?: TelegramCommandRoutingSettings;
  } = {},
): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  const row = (field: SettingsEditField, label: string) => ({
    text: label,
    callback_data: `settings:edit:${field}:${communityId}`,
  });
  const hintLabel = options.reactionNoHashtagHintEnabled !== false
    ? 'Подсказка без хэштега: вкл'
    : 'Подсказка без хэштега: выкл';
  const panelLabel = options.votePanelEnabled
    ? 'Панель голосования: вкл'
    : 'Панель голосования: выкл';
  const routing = options.commandRouting;
  const cmdRow = (cmd: TelegramRoutableCommand) => ({
    text: formatTelegramCommandDeliveryLabel(
      cmd,
      resolveTelegramCommandDelivery(routing, cmd),
    ),
    callback_data: `settings:cmd_route:${cmd}:${communityId}`,
  });
  return {
    inline_keyboard: [
      [row('name', 'Название'), row('quota', 'Квота')],
      [row('post_cost', 'Стоимость поста'), row('hashtag', 'Хэштег')],
      [row('welcome', 'Приветственные заслуги')],
      [
        {
          text: hintLabel,
          callback_data: `settings:toggle:reaction_no_hashtag:${communityId}`,
        },
        {
          text: panelLabel,
          callback_data: `settings:toggle:vote_panel:${communityId}`,
        },
      ],
      [cmdRow('balance'), cmdRow('members')],
      [cmdRow('help'), cmdRow('link')],
    ],
  };
}

function joinTelegramBlocks(blocks: string[]): string {
  return blocks.filter((block) => block.trim().length > 0).join('\n\n');
}

function buildPostsStep(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  return (
    `1. Публикуйте посты с #${hashtag}, чтобы собирать заслуги для себя. ` +
    `Если вы хотите собирать заслуги для другого пользователя, просто ответьте на его сообщение ` +
    `и добавьте в свой ответ #${hashtag} или напишите в своём сообщении «#${hashtag} для @username».`
  );
}

function buildVotingStep(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  if (input.votePanelEnabled) {
    return (
      `2. Голосуйте за чужие посты с #${hashtag} кнопками под постом (+1, своя сумма, против)`
    );
  }
  return `2. Голосуйте за чужие посты с #${hashtag} реакциями 👍 ❤️ 👎`;
}

function buildMiniAppStep(): string {
  return '3. Проверяйте баланс и историю в мини-приложении (ссылка ниже)';
}

function buildGuideStep(): string {
  return '4. Если нужен подробный гайд, отправьте команду /guide — бот пришлёт инструкцию в личку';
}

function buildNumberedUsageSteps(input: CommunityUsageRulesInput): string {
  return joinTelegramBlocks([
    buildPostsStep(input),
    buildVotingStep(input),
    buildMiniAppStep(),
    buildGuideStep(),
  ]);
}

function buildGroupWelcomeSteps(input: CommunityUsageRulesInput): string {
  return buildNumberedUsageSteps(input);
}

function buildHashtagAndMiniAppIntro(input: CommunityUsageRulesInput): string {
  return buildNumberedUsageSteps(input);
}

function buildReactionVotingRules(votePanelEnabled?: boolean): string {
  if (votePanelEnabled) {
    return joinTelegramBlocks([
      'Голосование',
      '• +1 / +3 / +5 — начислить заслуги\n' +
        '• Своя сумма — введите число ответом на подсказку бота\n' +
        '• Против — списать заслуги с получателя\n' +
        '• Текущая сумма заслуг — строка «Сейчас заслуг: …» под постом',
    ]);
  }
  return joinTelegramBlocks([
    'Голосование реакциями',
    '• 👍 — поддержать быстро +1 заслуга автору\n' +
      '• ❤️ — поддержать сильнее (выберите сумму кнопкой)\n' +
      '• 👎 — не согласен (списание с вашего кошелька, выберите сумму)',
  ]);
}

function buildReplyVoteHint(votePanelEnabled?: boolean): string {
  if (votePanelEnabled) {
    return '';
  }
  return `Или просто ответьте на пост в таком формате: «+3 Отличная работа» или «-2 Не согласен».`;
}

function buildDailyMeritsParagraph(dailyEmission: number): string {
  if (dailyEmission <= 0) {
    return '';
  }
  return (
    `\n\nКаждый день вы получаете ${dailyEmission} заслуг на голоса: они сгорают в полночь. ` +
    `Сначала тратятся они, потом кошелёк — заслуги от других за ваши посты.`
  );
}

function buildWelcomeMeritsParagraph(welcomeMerits?: number): string {
  if (welcomeMerits == null || welcomeMerits <= 0) {
    return '';
  }
  return `\n\nНовым участникам — ${welcomeMerits} приветственных заслуг.`;
}

function buildHelpUsageIntro(input: CommunityUsageRulesInput): string {
  return buildNumberedUsageSteps(input);
}

function buildCommunityUsageBody(input: CommunityUsageRulesInput): string {
  const blocks = [
    buildHashtagAndMiniAppIntro(input),
    buildReactionVotingRules(input.votePanelEnabled),
    buildReplyVoteHint(input.votePanelEnabled),
  ];
  return joinTelegramBlocks(blocks);
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

export type TelegramInlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

export type TelegramInlineReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

/** Deep link to open bot DM with optional /start payload (e.g. guide, vote). */
export function buildTelegramBotStartLink(
  botUsername: string,
  startPayload?: string,
): string {
  const clean = botUsername.replace(/^@/, '').trim();
  if (startPayload?.trim()) {
    return `https://t.me/${clean}?start=${encodeURIComponent(startPayload.trim())}`;
  }
  return `https://t.me/${clean}`;
}

export function buildTelegramBotOpenKeyboard(
  botUsername: string,
  startPayload: string,
  buttonLabel: string,
): TelegramInlineReplyMarkup {
  return {
    inline_keyboard: [
      [{ text: buttonLabel, url: buildTelegramBotStartLink(botUsername, startPayload) }],
    ],
  };
}

export const TG_BOT_OPEN_BUTTON_LABELS = {
  guide: 'Получить гайд в личку',
  vote: 'Открыть бота',
} as const;

function formatTelegramBotHandle(botUsername: string): string {
  return botUsername.replace(/^@/, '').trim();
}

export function formatTelegramBotOpenHint(
  botUsername: string,
  purpose: 'guide' | 'vote',
): string {
  const handle = formatTelegramBotHandle(botUsername);
  if (purpose === 'guide') {
    return (
      `Не удалось отправить гайд в личку — вы ещё не запускали бота.\n\n` +
      `Откройте бота (кликните @${handle} или кнопку ниже) — гайд придёт в личку.`
    );
  }
  return (
    `Не удалось написать вам в личку — вы ещё не запускали бота.\n\n` +
    `Откройте бота (кликните @${handle} или кнопку ниже), затем повторите реакцию в группе.`
  );
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
    votePanelEnabled?: boolean;
  },
): string {
  const rulesBlock = `${buildHelpUsageIntro({
    communityName: options?.communityName ?? 'сообщество',
    hashtags: options?.hashtags,
    platformIntegration: options?.platformIntegration,
    botUsername: options?.botUsername,
    votePanelEnabled: options?.votePanelEnabled,
  })}\n\n`;

  return (
    `${rulesBlock}` +
    `Команды в чате:\n` +
    `/balance — ваши заслуги\n` +
    `/members — список участников\n` +
    `/settings — настройки (лид)\n` +
    `/help — краткая подсказка\n` +
    `/guide — подробный гайд (в личку)\n` +
    `/link — ссылка на мини-приложение\n` +
    `/linkandpin — ссылка и закрепить`
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
  voteSuccess: (
    voterName: string,
    amount: number,
    direction: 'up' | 'down',
    recipient?: { credit: string; debit: string },
  ) => {
    const credit = recipient?.credit ?? 'автору';
    const debit = recipient?.debit ?? 'автора';
    return direction === 'up'
      ? `${voterName} начислил ${credit} ${amount} заслуг.`
      : `${voterName} списал у ${debit} ${amount} заслуг.`;
  },
  voteAmountWrongUser:
    'Эти кнопки — не для вас. Чтобы проголосовать, поставьте ❤️ или 👎 под постом.',
  reactionPostNotFound: (hashtag: string) =>
    `Это сообщение не в Meriter. Голосовать можно только за посты с хэштегом #${hashtag}`,
  cannotVoteOwnPost: 'Голосовать за собственный пост нельзя.',
  cannotVoteAsBeneficiary: 'Нельзя голосовать за пост, где вы получатель заслуг.',
  voteAmountDmPrompt:
    'Насколько заслуг начислить автору?\n\nВыберите сумму кнопкой или напишите число.',
  voteAmountDmPromptDown:
    'Насколько заслуг списать с автора?\n\nВыберите сумму кнопкой или напишите число.',
  voteAmountGroupPrompt:
    'Насколько заслуг начислить автору?\n\nВыберите сумму кнопкой или ответьте числом на это сообщение.',
  voteAmountGroupPromptDown:
    'Насколько заслуг списать с автора?\n\nВыберите сумму кнопкой или ответьте числом на это сообщение.',
  balanceSelf: (name: string, wallet: number, quota: number, quotaMax: number, pct: number) =>
    `Ваши заслуги в «${name}»:\n\n` +
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
    'Чтобы открыть интерфейс Meriter, проверить свой баланс и заслуги других участников, кликните по ссылке ниже.\n\n' +
    'Полный гайд по Meriter: /guide (бот пришлёт в личку).',
  enterAmount: 'Напишите число — сколько заслуг начислить автору:',
  voteAmountDmFailed: (botUsername: string) => formatTelegramBotOpenHint(botUsername, 'vote'),
  voteStartAfterOpen:
    'Бот запущен. Вернитесь в группу и повторите реакцию ❤️ или 👎 под постом.',
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. Напишите /help или /guide — там все подсказки.',
  guideDmFailed: (botUsername: string) => formatTelegramBotOpenHint(botUsername, 'guide'),
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
  settingsUpdated: (snapshot: ReturnType<typeof communitySettingsSnapshot>) => {
    const quotaLine =
      snapshot.dailyEmission > 0
        ? `${snapshot.dailyEmission} заслуг в день`
        : 'выключена';
    return (
      `Сохранено.\n\n` +
      `• Название: «${snapshot.name}»\n` +
      `• Ежедневная квота: ${quotaLine}\n` +
      `• Стоимость поста: ${snapshot.postCost} заслуг\n` +
      `• Хэштег: #${snapshot.hashtag}\n` +
      `• Приветственные заслуги: ${snapshot.welcomeMerits}`
    );
  },
  settingsEditInvalidNumber: 'Напишите целое число ≥ 0.',
  settingsEditEmptyName: 'Название не может быть пустым.',
  settingsReactionNoHashtagHintToggled: (enabled: boolean) =>
    enabled
      ? 'Подсказка без хэштега включена.'
      : 'Подсказка без хэштега выключена.',
  settingsVotePanelToggled: (enabled: boolean) =>
    enabled ? 'Панель голосования включена.' : 'Панель голосования выключена.',
  settingsCommandRouteCycled: (label: string) => `Команда: ${label}`,
  commandAnswerInDm: 'Ответ отправлен в личку с ботом.',
  miniAppLinkUnavailable: 'Ссылка на приложение временно недоступна. Попробуйте позже.',
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

export type TelegramTextMentionEntity = {
  type: 'text_mention';
  offset: number;
  length: number;
  user: { id: number; is_bot: false; first_name: string; last_name?: string; username?: string };
};

export function buildTelegramVoterDisplayName(input: {
  firstName?: string;
  lastName?: string;
  username?: string;
}): string {
  const fromName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  if (fromName) return fromName;
  if (input.username?.trim()) return `@${input.username.replace(/^@/, '')}`;
  return 'участник';
}

/** Group vote-amount prompt (ForceReply): leading @mention + numeric input. */
export function buildVoteAmountGroupNumericMentionMessage(
  tgUserId: number,
  displayName: string,
  direction: 'up' | 'down',
): { text: string; entities: TelegramTextMentionEntity[] } {
  const name = displayName.trim() || 'участник';
  const suffix =
    direction === 'down'
      ? ', введите сумму заслуг для списания ответом на это сообщение.'
      : ', введите сумму заслуг ответом на это сообщение.';
  const firstName = name.startsWith('@') ? name.slice(1) : name.split(/\s+/)[0] || name;
  return {
    text: `${name}${suffix}`,
    entities: [
      {
        type: 'text_mention',
        offset: 0,
        length: name.length,
        user: {
          id: tgUserId,
          is_bot: false,
          first_name: firstName,
        },
      },
    ],
  };
}

/** Group vote-amount prompt: leading @mention + reply under reacted message. */
export function buildVoteAmountGroupMentionMessage(
  tgUserId: number,
  displayName: string,
  direction: 'up' | 'down',
): { text: string; entities: TelegramTextMentionEntity[] } {
  const name = displayName.trim() || 'участник';
  const suffix =
    direction === 'down'
      ? ', сколько заслуг списать с автора?\n\nВыберите сумму кнопкой или ответьте числом.'
      : ', сколько заслуг начислить автору?\n\nВыберите сумму кнопкой или ответьте числом.';
  const firstName = name.startsWith('@') ? name.slice(1) : name.split(/\s+/)[0] || name;
  return {
    text: `${name}${suffix}`,
    entities: [
      {
        type: 'text_mention',
        offset: 0,
        length: name.length,
        user: {
          id: tgUserId,
          is_bot: false,
          first_name: firstName,
        },
      },
    ],
  };
}

export function meritTransferGroupMessage(
  senderName: string,
  receiverName: string,
  amount: number,
  comment?: string | null,
): string {
  const base = `${senderName} перевёл ${amount} заслуг ${receiverName}.`;
  const trimmed = comment?.trim();
  return trimmed ? `${base}\nКомментарий: ${trimmed}` : base;
}
