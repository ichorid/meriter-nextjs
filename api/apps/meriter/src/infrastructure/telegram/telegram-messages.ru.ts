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
  onboarding_new_member_welcome:
    'Приветствовать новых участников при входе в группу?\n\n' +
    'Бот отправит короткое сообщение с просьбой написать /start.',
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
    telegramNewMemberWelcomeEnabled?: boolean;
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
  const voteSuccessEphemeral =
    community.settings?.telegramVoteSuccessEphemeral !== false ? 'исчезает' : 'остаётся';
  const newMemberWelcome =
    community.settings?.telegramNewMemberWelcomeEnabled !== false ? 'вкл' : 'выкл';
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
    `• Отчёт о голосе: ${voteSuccessEphemeral}\n` +
    `• Приветствие новых участников: ${newMemberWelcome}\n` +
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
    voteSuccessEphemeral?: boolean;
    newMemberWelcomeEnabled?: boolean;
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
  const voteSuccessLabel =
    options.voteSuccessEphemeral !== false
      ? 'Отчёт о голосе: исчезает'
      : 'Отчёт о голосе: остаётся';
  const newMemberWelcomeLabel =
    options.newMemberWelcomeEnabled !== false
      ? 'Приветствие новых: вкл'
      : 'Приветствие новых: выкл';
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
      [
        {
          text: voteSuccessLabel,
          callback_data: `settings:toggle:vote_success_ephemeral:${communityId}`,
        },
        {
          text: newMemberWelcomeLabel,
          callback_data: `settings:toggle:new_member_welcome:${communityId}`,
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

function buildPostForSelfStep(input: CommunityUsageRulesInput, inGroupChat = false): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  if (inGroupChat) {
    return `1. В групповом чате публикуйте посты с #${hashtag}, чтобы собирать заслуги для себя.`;
  }
  return `1. Публикуйте посты с #${hashtag}, чтобы собирать заслуги для себя.`;
}

function buildPostForOthersStep(input: CommunityUsageRulesInput, inGroupChat = false): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  const replyHint = inGroupChat
    ? 'в групповом чате ответьте на его сообщение'
    : 'ответьте на его сообщение';
  return (
    `2. Если вы хотите собирать заслуги для другого пользователя, ${replyHint} ` +
    `и добавьте #${hashtag}, либо напишите «#${hashtag} для …» и выберите участника из списка @ по имени (как «Иван»).`
  );
}

function buildVotingStep(input: CommunityUsageRulesInput, inGroupChat = false): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  if (input.votePanelEnabled) {
    if (inGroupChat) {
      return `3. В групповом чате голосуйте за чужие посты с #${hashtag} кнопками, которые бот размещает под его постом`;
    }
    return `3. Голосуйте за чужие посты с #${hashtag} кнопками, которые бот размещает под его постом`;
  }
  if (inGroupChat) {
    return `3. В групповом чате голосуйте за чужие посты с #${hashtag} реакциями 👍 ❤️ 👎`;
  }
  return `3. Голосуйте за чужие посты с #${hashtag} реакциями 👍 ❤️ 👎`;
}

function buildMiniAppStep(): string {
  return '4. Проверяйте баланс и историю в мини-приложении (ссылка ниже)';
}

function buildGuideStep(): string {
  return '5. Если нужен подробный гайд, отправьте команду /guide — бот пришлёт инструкцию в личку';
}

function buildNumberedUsageSteps(input: CommunityUsageRulesInput): string {
  return joinTelegramBlocks([
    buildPostForSelfStep(input),
    buildPostForOthersStep(input),
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
        '• Текущая сумма заслуг — строка «Заслуг собрано: …» под постом',
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
  viewGuideInDm: 'Посмотреть гайд',
  openBot: 'Открыть бота Meriter',
  returnToGroupChat: 'Вернуться в чат',
  miniApp: 'Мини-приложение',
  vote: 'Открыть бота',
  settings: 'Открыть настройки в личку',
} as const;

const MEMBER_JOIN_START_PREFIX = 'join_';

export function buildMemberJoinStartPayload(communityId: string): string {
  return `${MEMBER_JOIN_START_PREFIX}${communityId.trim()}`;
}

export function parseMemberJoinStartPayload(referral: string): string | null {
  const trimmed = referral.trim();
  if (!trimmed.startsWith(MEMBER_JOIN_START_PREFIX)) {
    return null;
  }
  const communityId = trimmed.slice(MEMBER_JOIN_START_PREFIX.length).trim();
  return /^[a-zA-Z0-9_-]+$/.test(communityId) ? communityId : null;
}

function formatTelegramBotHandle(botUsername: string): string {
  return botUsername.replace(/^@/, '').trim();
}

export function formatTelegramBotOpenHint(
  botUsername: string,
  purpose: 'guide' | 'vote' | 'settings',
): string {
  const handle = formatTelegramBotHandle(botUsername);
  if (purpose === 'guide') {
    return (
      `Не удалось отправить гайд в личку — вы ещё не запускали бота.\n\n` +
      `Откройте бота (кликните @${handle} или кнопку ниже) — гайд придёт в личку.`
    );
  }
  if (purpose === 'settings') {
    return (
      `Не удалось отправить настройки в личку — вы ещё не запускали бота.\n\n` +
      `Откройте бота (кликните @${handle} или кнопку ниже), затем снова /settings в группе.`
    );
  }
  return (
    `Не удалось написать вам в личку — вы ещё не запускали бота.\n\n` +
    `Откройте бота (кликните @${handle} или кнопку ниже), затем повторите реакцию в группе.`
  );
}

export function resolveNewMemberGreetingName(profile: {
  first_name?: string;
  last_name?: string;
}): string {
  const first = profile.first_name?.trim();
  if (first) {
    return first;
  }
  const last = profile.last_name?.trim();
  if (last) {
    return last;
  }
  return 'друг';
}

export function buildNewMemberWelcomeMessage(greetingName: string): string {
  return (
    `Привет, ${greetingName}!\n\n` +
    `В этой группе работает бот Meriter — он ведёт учёт заслуг участников.\n\n` +
    `Чтобы начать, нажмите кнопку ниже. В открывшемся чате с ботом нажмите «Запустить» или напишите /start.`
  );
}

export type MemberWelcomeLandingInput = {
  communityName: string;
  communityId?: string;
  hashtags?: string[];
  botUsername?: string;
  votePanelEnabled?: boolean;
  isReturning: boolean;
  wallet: number;
  quota: number;
  quotaMax: number;
  startWelcomeMerits?: number;
};

export function buildMemberWelcomeLandingMessage(input: MemberWelcomeLandingInput): string {
  const usageInput: CommunityUsageRulesInput = {
    communityName: input.communityName,
    hashtags: input.hashtags,
    botUsername: input.botUsername,
    votePanelEnabled: input.votePanelEnabled,
  };

  const intro = input.isReturning
    ? `Снова здесь! Группа «${input.communityName}».\n\n` +
      `Напоминание: посты, голосование и команды — в групповом чате, не здесь в личке. ` +
      `Личка с ботом — для подсказок, баланса и мини-приложения.`
    : `Добро пожаловать в Meriter!\n\n` +
      `Группа «${input.communityName}».\n\n` +
      `Главное: заслуги, посты и голосование — в групповом чате, а не здесь. ` +
      `Личка с ботом — для подсказок, баланса и мини-приложения.`;

  const welcomeGrant =
    !input.isReturning && input.startWelcomeMerits != null && input.startWelcomeMerits > 0
      ? `\n\nВам начислено ${input.startWelcomeMerits} приветственных заслуг.`
      : '';

  const statsParts = [`Баланс: ${input.wallet} заслуг`];
  if (input.quotaMax > 0) {
    statsParts.push(`квота сегодня: ${input.quota}/${input.quotaMax}`);
  }
  const statsLine = `\n\n${statsParts.join(' · ')}`;

  const steps = joinTelegramBlocks([
    buildPostForSelfStep(usageInput, true),
    buildPostForOthersStep(usageInput, true),
    buildVotingStep(usageInput, true),
    buildMiniAppStep(),
    buildGuideStep(),
  ]);

  return (
    `${intro}${welcomeGrant}${statsLine}\n\n` +
    `${steps}\n\n` +
    `Команды (/balance, /members, /help …) пишите в групповом чате, не здесь.\n\n` +
    `Подробный гайд: /guide в групповом чате или здесь в личке.`
  );
}

export function buildMemberWelcomeLandingKeyboard(options: {
  groupChatUrl?: string | null;
  miniAppUrl?: string | null;
}): TelegramInlineReplyMarkup | undefined {
  const rows: TelegramInlineReplyMarkup['inline_keyboard'] = [];
  if (options.groupChatUrl?.trim()) {
    rows.push([
      {
        text: TG_BOT_OPEN_BUTTON_LABELS.returnToGroupChat,
        url: options.groupChatUrl.trim(),
      },
    ]);
  }
  if (options.miniAppUrl?.trim()) {
    const raw = options.miniAppUrl.trim();
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    rows.push([{ text: TG_BOT_OPEN_BUTTON_LABELS.miniApp, url }]);
  }
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

export function buildDmCommunityPickerKeyboard(
  communities: Array<{ communityId: string; name: string }>,
): TelegramInlineReplyMarkup {
  return {
    inline_keyboard: communities.map((community) => [
      {
        text: (community.name.trim() || community.communityId).slice(0, 64),
        callback_data: `dm:pick:${community.communityId}`.slice(0, 64),
      },
    ]),
  };
}

export function telegramDmCommandLabel(cmd: string): string {
  switch (cmd.toLowerCase()) {
    case 'balance':
    case 'баланс':
      return '/balance';
    case 'members':
    case 'участники':
      return '/members';
    case 'help':
    case 'помощь':
      return '/help';
    case 'guide':
      return '/guide';
    case 'link':
      return '/link';
    case 'settings':
      return '/settings';
    default:
      return `/${cmd}`;
  }
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
    /** Shown on /start for new members only (after welcome merits grant). */
    startWelcomeMerits?: number;
  },
): string {
  const input: CommunityUsageRulesInput = {
    communityName: options?.communityName ?? 'сообщество',
    hashtags: options?.hashtags,
    platformIntegration: options?.platformIntegration,
    botUsername: options?.botUsername,
    votePanelEnabled: options?.votePanelEnabled,
  };
  const miniAppLink =
    options?.botUsername != null
      ? buildTelegramMiniAppStartLink(options.botUsername, options?.communityId)
      : undefined;
  const miniAppStep =
    miniAppLink != null
      ? `4. Проверяйте баланс и историю в мини-приложении: ${miniAppLink}`
      : '4. Проверяйте баланс и историю в мини-приложении (команда /link).';

  const welcomeGrant =
    options?.startWelcomeMerits != null && options.startWelcomeMerits > 0
      ? `\n\nВам начислено ${options.startWelcomeMerits} приветственных заслуг. Дальше всё просто:`
      : '';

  const steps = joinTelegramBlocks([
    buildPostForSelfStep(input),
    buildPostForOthersStep(input),
    buildVotingStep(input),
    miniAppStep,
    buildGuideStep(),
  ]);

  return (
    `Добро пожаловать в Meriter!${welcomeGrant}\n\n` +
    `${steps}\n\n` +
    `Команды в чате:\n` +
    `/balance — ваши заслуги\n` +
    `/members — список участников\n` +
    `/help — краткая подсказка\n` +
    `/guide — подробный гайд (в личку)\n` +
    `/link — ссылка на мини-приложение\n` +
    `/settings — настройки (только для администратора группы)\n` +
    `/linkandpin — ссылка и закрепить`
  );
}

/** Map backend errors to plain Russian for chat users. */
export function mapTelegramUserFacingError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('insufficient quota')) {
    return 'Не хватает квоты на сегодня. Проверьте баланс командой /balance.';
  }
  if (
    lower.includes('insufficient wallet') ||
    lower.includes('insufficient recipient wallet') ||
    lower.includes('insufficient') ||
    lower.includes('not enough')
  ) {
    return TG_MSG.insufficientMerits;
  }
  if (lower.includes('cannot vote for own') || lower.includes('own post')) {
    return TG_MSG.cannotVoteOwnPost;
  }
  if (lower.includes('downvotes are disabled')) {
    return 'Списание заслуг (минус) отключено в этом сообществе.';
  }
  if (lower.includes('closed and cannot')) {
    return 'Пост закрыт — голосовать нельзя.';
  }
  if (lower.includes('event publications cannot')) {
    return 'За события голосовать нельзя.';
  }
  if (lower.includes('only project members')) {
    return 'Голосовать заслугами могут только участники проекта.';
  }
  if (lower.includes('frozen') || lower.includes('заморож')) {
    return TG_MSG.frozenMember;
  }
  if (
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('do not have permission') ||
    lower.includes('доступ')
  ) {
    return 'У вас нет прав для этого действия.';
  }
  if (/[\u0400-\u04FF]/.test(message)) {
    return message;
  }
  return TG_MSG.actionFailedGeneric;
}

export const TG_VOTE_DEFAULT_COMMENT = 'В Telegram-группе';

export type VoteSuccessRecipient = {
  credit: string;
  debit: string;
  /** Nominator display label when post is a beneficiary nomination. */
  nominator?: string;
};

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
    recipient?: VoteSuccessRecipient,
  ) => {
    const credit = recipient?.credit ?? 'автору';
    const debit = recipient?.debit ?? 'автора';
    const nominationSuffix = recipient?.nominator
      ? ` (номинация от ${recipient.nominator})`
      : '';
    return direction === 'up'
      ? `${voterName} начислил ${credit} ${amount} заслуг${nominationSuffix}.`
      : `${voterName} списал у ${debit} ${amount} заслуг${nominationSuffix}.`;
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
  voteAmountInvalidRetry:
    'Не понял сумму. Напишите число — например 10 или 10 заслуг.\n\n' +
    'Ответьте на это сообщение: внизу уже открыто поле ввода.',
  voteDirectionFlippedFromSign:
    'Вы указали «−» — списываем заслуги с автора (против), а не начисляем.',
  voteDirectionFlippedFromSignUp:
    'Вы указали «+» — начисляем заслуги автору, а не списываем.',
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
  onboardingRelinkFrozenLead: (communityName: string, communityId: string) =>
    `У вас уже есть сообщество «${communityName}», привязанное к другой группе Telegram.\n\n` +
    `Добавьте бота в новую группу — при повторном добавлении привязка восстановится автоматически. ` +
    `Если мастер настройки уже начался, завершите его или откройте /start relink:${communityId} после добавления бота в группу.`,
  relinkCommunitySuccess: (communityName: string) =>
    `Группа снова привязана к «${communityName}». Можно пользоваться ботом.`,
  relinkCommunityNotAllowed:
    'Не удалось привязать группу. Проверьте, что вы лид этого сообщества и состоите в группе Telegram.',
  relinkCommunityNeedGroup: (communityName: string) =>
    `Чтобы привязать «${communityName}» к новой группе, сначала добавьте бота в эту группу, ` +
    `затем снова откройте ссылку /start relink:… из лички с ботом.`,
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
  groupNotLinked: (botUsername?: string) => {
    const handle = botUsername?.replace(/^@/, '').trim();
    const atBot = handle ? `@${handle}` : '@ботом';
    return (
      'Бот не привязан к этой группе.\n\n' +
      `Тому, кто добавил бота, нужно завершить настройку в личке с ${atBot}.`
    );
  },
  onboardingCommandDeliveryInvalid:
    'Ответьте 1, 2 или 3 — см. варианты в вопросе выше.',
  onboardingCommandDeliveryNumericSuffix: 'Ответьте 1, 2 или 3.',
  onboardingInProgress:
    'Настройка не завершена. Продолжите ответы в личке с ботом — бот задаст следующий вопрос.',
  multipleLinkedCommunities:
    'У вас несколько сообществ Meriter. Используйте команды в той группе, где хотите действовать.',
  dmPickCommunity: (commandLabel: string) =>
    `Вы состоите в нескольких сообществах Meriter. Выберите, для какого выполнить «${commandLabel}»:`,
  relinkCommunityMemberNeedLead: (communityName: string) =>
    `Сообщество «${communityName}» на паузе. Попросите лидера добавить бота в группу и открыть /start relink:…`,
  relinkCommunityAlreadyActive: (communityName: string) =>
    `Сообщество «${communityName}» уже активно — бот снова в группе.`,
  anonymousReactionsDisabled:
    'Анонимные реакции не учитываются. Поставьте обычную реакцию ❤️ или 👎 под постом Meriter.',
  actionFailedGeneric:
    'Не удалось выполнить действие. Попробуйте /balance или обратитесь к лиду сообщества.',
  memberJoinDeepLinkCommunityNotFound:
    'Не удалось найти это сообщество Meriter. Вернитесь в группу и нажмите кнопку ещё раз.',
  memberJoinDeepLinkNotInGroup: (communityName: string) =>
    `Вы не состоите в группе «${communityName}». Вернитесь в группу Telegram и нажмите кнопку снова.`,
  settingsLeadOnly: 'Настройки бота доступны только лиду сообщества.',
  settingsDmFailed: (botUsername: string) => formatTelegramBotOpenHint(botUsername, 'settings'),
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
  settingsVoteSuccessEphemeralToggled: (enabled: boolean) =>
    enabled
      ? 'Отчёт о голосе: исчезает из чата.'
      : 'Отчёт о голосе: остаётся в чате.',
  settingsNewMemberWelcomeToggled: (enabled: boolean) =>
    enabled
      ? 'Приветствие новых участников включено.'
      : 'Приветствие новых участников выключено.',
  settingsCommandRouteCycled: (label: string) => `Команда: ${label}`,
  commandAnswerInDm: 'Ответ отправлен в личку с ботом.',
  miniAppLinkUnavailable: 'Ссылка на приложение временно недоступна. Попробуйте позже.',
  postSavedAck: 'Пост сохранён в Meriter.',
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

export function formatVoteAmountBalanceHint(
  wallet: number,
  quota: number,
  direction: 'up' | 'down',
): string {
  if (direction === 'down') {
    return (
      `\n\nВсего у вас сейчас ${wallet} заслуг на кошельке — списать можно не больше ${wallet}.`
    );
  }
  const max = wallet + quota;
  return (
    `\n\nВсего у вас сейчас ${wallet} заслуг на кошельке и ${quota} ежедневных заслуг, ` +
    `сумма может быть не больше ${max}.`
  );
}

/** Group vote-amount prompt (ForceReply): leading @mention + numeric input. */
export function buildVoteAmountGroupNumericMentionMessage(
  tgUserId: number,
  displayName: string,
  direction: 'up' | 'down',
  balance?: { wallet: number; quota: number },
): { text: string; entities: TelegramTextMentionEntity[] } {
  const name = displayName.trim() || 'участник';
  const suffix =
    direction === 'down'
      ? ', введите сумму заслуг для списания ответом на это сообщение.'
      : ', введите сумму заслуг ответом на это сообщение.';
  const hint = balance
    ? formatVoteAmountBalanceHint(balance.wallet, balance.quota, direction)
    : '';
  const firstName = name.startsWith('@') ? name.slice(1) : name.split(/\s+/)[0] || name;
  return {
    text: `${name}${suffix}${hint}`,
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
  balance?: { wallet: number; quota: number },
): { text: string; entities: TelegramTextMentionEntity[] } {
  const name = displayName.trim() || 'участник';
  const suffix =
    direction === 'down'
      ? ', сколько заслуг списать с автора?\n\nВыберите сумму кнопкой или ответьте числом.'
      : ', сколько заслуг начислить автору?\n\nВыберите сумму кнопкой или ответьте числом.';
  const hint = balance
    ? formatVoteAmountBalanceHint(balance.wallet, balance.quota, direction)
    : '';
  const firstName = name.startsWith('@') ? name.slice(1) : name.split(/\s+/)[0] || name;
  return {
    text: `${name}${suffix}${hint}`,
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
