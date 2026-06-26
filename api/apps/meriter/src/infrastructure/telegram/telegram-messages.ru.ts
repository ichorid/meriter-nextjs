/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

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
  communityId?: string,
): string {
  const openLine = communityId
    ? `\nОткрыть веб: ${communityWebFeedUrl(communityWebBaseUrl, communityId)}`
    : `\nВход в веб: ${communityWebLoginUrl(communityWebBaseUrl)}`;
  return (
    'Команды:\n/balance — ваш баланс\n/members — рейтинг с %\n/fund — общий фонд\n/transfer @user N — перевод\n/transfer N (ответ на сообщение) — перевод\n/post текст — опубликовать пост (лид)\n/help — справка' +
    openLine
  );
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
  transferConfirm: (amount: number, name: string) =>
    `Перевести ${amount} заслуг пользователю ${name}?`,
  transferDone: (amount: number, balance: number) =>
    `Готово. Переведено ${amount} заслуг. Ваш баланс: ${balance}.`,
  transferReceived: (amount: number, fromName: string) =>
    `Вам перевели ${amount} заслуг от ${fromName}.`,
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
  onboardingWelcome: 'Приветственные заслуги новым участникам? (0 = не начислять)',
  onboardingDone: (name: string) =>
    `Сообщество «${name}» настроено. Правила:\n• 👍 = +1 заслуга\n• ❤️ = спросить сумму в личке\n• 🤡 = минус (только с кошелька)\n• Reply +N текст — голос с комментарием\n• /balance /members /transfer\n\nЗаслуги — не деньги.`,
  groupWelcome: (name: string) =>
    `Meriter подключён к «${name}». Голосуйте реакциями на посты бота и сообщения с хэштегом. Команды: /balance /members /transfer /post`,
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество заморожено — траты и начисления заслуг остановлены.',
  help:
    'Команды:\n/balance — ваш баланс\n/members — рейтинг с %\n/fund — общий фонд\n/transfer @user N — перевод\n/transfer N (ответ на сообщение) — перевод\n/post текст — опубликовать пост (лид)\n/help — справка',
  postPublished: 'Пост опубликован.',
  enterAmount: 'Введите количество заслуг (число):',
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. /help — справка.',
  noLinkedCommunity:
    'Нет привязанного Telegram-сообщества. Добавьте бота в группу и завершите мастер настройки в личке.',
  groupNotLinked:
    'Бот не привязан к этой группе. Завершите мастер настройки в личке с ботом (тому, кто добавил бота).',
  onboardingInProgress: 'Мастер настройки не завершён. Продолжите в личке с ботом.',
  multipleLinkedCommunities:
    'У вас несколько Telegram-сообществ. Используйте команды в соответствующей группе.',
} as const;

export const TG_EMOJI = {
  up: '👍',
  upAlt: '👍🏻',
  heart: '❤',
  heartFull: '❤️',
  down: '🤡',
} as const;
