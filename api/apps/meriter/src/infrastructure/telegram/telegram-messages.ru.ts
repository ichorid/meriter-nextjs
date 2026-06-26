/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

export type CommunityUsageRulesInput = {
  communityName: string;
  hashtags?: string[];
};

export function primaryCommunityHashtag(hashtags?: string[]): string {
  const tag = (hashtags?.[0] ?? 'идея').replace(/^#/, '').trim();
  return tag || 'идея';
}

export function buildCommunityUsageRules(input: CommunityUsageRulesInput): string {
  const hashtag = primaryCommunityHashtag(input.hashtags);
  return (
    `Правила:\n` +
    `• Публикация: #${hashtag} в тексте сообщения\n` +
    `• 👍 = +1 заслуга автору (на чужих — квота/кошелёк; на своих — только кошелёк)\n` +
    `• ❤️ = бот попросит сумму ответом в группе\n` +
    `• 🤡 = минус с кошелька (бот попросит сумму ответом в группе)\n` +
    `• Reply +N текст или -N текст — голос с комментарием\n` +
    `• /balance /members /transfer /fund /post /help /settings\n\n` +
    `Заслуги — не деньги.`
  );
}

export function buildOnboardingDoneMessage(input: CommunityUsageRulesInput): string {
  return `Сообщество «${input.communityName}» настроено.\n\n${buildCommunityUsageRules(input)}`;
}

export function buildGroupWelcomeMessage(input: CommunityUsageRulesInput): string {
  return (
    `Meriter подключён к «${input.communityName}».\n\n` +
    `Голосуйте реакциями на посты бота и сообщения с хэштегом.\n\n` +
    buildCommunityUsageRules(input)
  );
}

export function communityWebFeedUrl(
  baseUrl: string,
  communityId: string,
): string {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/c/${communityId}/feed`;
}

export function communityWebLoginUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/login`;
}

export function buildTelegramHelpMessage(
  communityWebBaseUrl: string,
  options?: {
    communityId?: string;
    communityName?: string;
    hashtags?: string[];
  },
): string {
  const openLine = options?.communityId
    ? `\n\nОткрыть веб: ${communityWebFeedUrl(communityWebBaseUrl, options.communityId)}`
    : `\n\nВход в веб: ${communityWebLoginUrl(communityWebBaseUrl)}`;

  const rulesBlock = options?.communityName
    ? `${buildCommunityUsageRules({
        communityName: options.communityName,
        hashtags: options.hashtags,
      })}\n\n`
    : `${buildCommunityUsageRules({ communityName: 'сообщество', hashtags: options?.hashtags })}\n\n`;

  return `${rulesBlock}Команды:\n/balance — баланс и квота\n/members — рейтинг участников\n/fund — общий фонд\n/transfer — перевод заслуг (в группе)\n/post — опубликовать пост (лид)\n/settings — настройки бота (лид)\n/help — эта справка${openLine}`;
}

export const TG_MSG = {
  frozenMember:
    'Ваш доступ к заслугам в этом сообществе приостановлен — вы не в Telegram-группе. Вернитесь в группу, чтобы снова участвовать.',
  communityFrozen:
    'Сообщество заморожено: бот удалён из группы. Заслуги временно недоступны.',
  insufficientMerits: 'Не хватает заслуг для этого действия.',
  voteConfirm: (amount: number, direction: 'up' | 'down') =>
    direction === 'up'
      ? `Подтвердить начисление ${amount} заслуг автору?`
      : `Подтвердить списание ${amount} заслуг с автора?`,
  transferDone: (amount: number, balance: number) =>
    `Готово. Переведено ${amount} заслуг. Ваш баланс: ${balance}.`,
  transferDoneGroup: (amount: number, receiverName: string, balance: number) =>
    `Переведено ${amount} заслуг → ${receiverName}. Ваш баланс: ${balance}.`,
  transferUseGroup:
    'Перевод заслуг доступен только в группе: ответьте на сообщение участника командой /transfer 5 или /transfer @username 5.',
  transferErrorSelf: 'Нельзя переводить заслуги самому себе.',
  transferErrorAmount: 'Укажите положительную сумму.',
  transferErrorReceiver: 'Получатель не найден в Meriter.',
  transferErrorFormat:
    'Формат: /transfer @username 5 или ответ на сообщение: /transfer 5',
  voteSuccess: (amount: number, direction: 'up' | 'down') =>
    direction === 'up'
      ? `Начислено ${amount} заслуг автору.`
      : `Списано ${amount} заслуг с автора.`,
  reactionPostNotFound: 'Пост не найден в Meriter — голосовать можно только по сохранённым публикациям.',
  voteAmountGroupPrompt: 'Ответьте числом на это сообщение — сколько заслуг начислить?',
  voteAmountGroupPromptSelf:
    'Ответьте числом на это сообщение — сколько заслуг начислить? (на свой пост — только с кошелька)',
  voteAmountGroupPromptDown: 'Ответьте числом на это сообщение — сколько заслуг списать?',
  balanceSelf: (name: string, wallet: number, quota: number, quotaMax: number, pct: number) =>
    `Ваши заслуги в «${name}»\n\nКошелёк: ${wallet}\nКвота сегодня: ${quota} из ${quotaMax}\nДоля от общего пула: ${pct.toFixed(1)}%`,
  membersHeader: 'Участники (активные):',
  memberLine: (display: string, wallet: number, pct: number) =>
    `• ${display}: ${wallet} (${pct.toFixed(1)}%)`,
  fundNone: 'Общий фонд для этого сообщества не настроен.',
  fundInfo: (balance: number, yourShare: number) =>
    `Общий фонд: ${balance} заслуг\nВаша доля: ${yourShare.toFixed(1)}%`,
  onboardingStart:
    'Добро пожаловать! Вы добавили бота Meriter. Как называется ваше сообщество? (отправьте название)',
  onboardingFutureVision:
    'Опишите образ будущего вашего сообщества — это обязательно и не может быть пустым.\n\nРасскажите, к чему вы стремитесь, какие ценности и цели объединяют участников. Текст сохранится в настройках Meriter и попадёт в ленту «Образы будущего».',
  onboardingFutureVisionEmpty:
    'Образ будущего обязателен — пустой текст принять нельзя. Отправьте осмысленное описание (хотя бы одно предложение).',
  onboardingFutureVisionTooLong: (max: number) =>
    `Слишком длинный текст. Сократите образ будущего до ${max} символов и отправьте снова.`,
  onboardingQuota: 'Включить ежедневную квоту заслуг? Ответьте «да» или «нет».',
  onboardingQuotaAmount: 'Сколько заслуг в день выдавать в квоте? (число, например 5)',
  onboardingHashtag:
    'Какой хэштег для постов из чата? (без #, например: идея)',
  onboardingPostCost: 'Стоимость публикации поста в заслугах? (0 = бесплатно)',
  onboardingModeration:
    'Нужна модерация постов перед публикацией? «да» или «нет»',
  onboardingPublicationAck:
    'Уведомлять в группе о сохранении постов с хэштегом? «да» или «нет» (по умолчанию — нет)',
  onboardingWelcome: 'Приветственные заслуги новым участникам? (0 = не начислять)',
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество заморожено — траты и начисления заслуг остановлены.',
  postPublished: 'Пост опубликован.',
  enterAmount: 'Введите количество заслуг (число):',
  enterAmountSelfUp:
    'Введите количество заслуг (число). На свой пост — только с кошелька.',
  voteAmountDmFailed: (botUsername: string) =>
    `Не удалось написать вам в личку. Откройте @${botUsername}, нажмите Start, затем повторите реакцию.`,
  voteAmountGroupHint: (botUsername: string, isSelfPost: boolean) =>
    isSelfPost
      ? `Для голоса откройте @${botUsername} в личке (Start) и введите сумму заслуг. На свой пост — только с кошелька.`
      : `Для голоса откройте @${botUsername} в личке (Start) и введите сумму заслуг.`,
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. /help — справка.',
  noLinkedCommunity:
    'Нет привязанного Telegram-сообщества. Добавьте бота в группу и завершите мастер настройки в личке.',
  groupNotLinked:
    'Бот не привязан к этой группе. Завершите мастер настройки в личке с ботом (тому, кто добавил бота).',
  onboardingInProgress: 'Мастер настройки не завершён. Продолжите в личке с ботом.',
  multipleLinkedCommunities:
    'У вас несколько Telegram-сообществ. Используйте команды в соответствующей группе.',
  settingsLeadOnly: 'Настройки бота доступны только лиду сообщества.',
  settingsUseGroup: 'Настройки бота доступны в группе: /settings (только лид).',
  settingsLead: (ackEnabled: boolean) =>
    `Настройки бота Meriter.\n\nУведомление о сохранении поста в группе: ${ackEnabled ? 'включено' : 'выключено'}.`,
  settingsAckUpdated: (enabled: boolean) =>
    enabled
      ? 'Уведомления о сохранении постов включены.'
      : 'Уведомления о сохранении постов выключены.',
} as const;

export const TG_EMOJI = {
  up: '👍',
  upAlt: '👍🏻',
  heart: '❤',
  heartFull: '❤️',
  down: '🤡',
} as const;
