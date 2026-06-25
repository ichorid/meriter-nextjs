/** Russian copy for Telegram MVP bot (product: «Заслуги»). */

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
  onboardingQuota: 'Включить ежедневную квоту заслуг? Ответьте «да» или «нет».',
  onboardingQuotaAmount: 'Сколько заслуг в день выдавать в квоте? (число, например 5)',
  onboardingHashtag:
    'Какой хэштег для постов из чата? (без #, например: идея)',
  onboardingPostCost: 'Стоимость публикации поста в заслугах? (0 = бесплатно)',
  onboardingModeration:
    'Нужна модерация постов перед публикацией? «да» или «нет»',
  onboardingWelcome: 'Приветственные заслуги новым участникам? (0 = не начислять)',
  onboardingDone: (name: string) =>
    `Сообщество «${name}» настроено. Правила:\n• 👍 = +1 заслуга\n• ❤️ = спросить сумму в личке\n• 🤡 = минус (только с кошелька)\n• Reply +N текст — голос с комментарием\n• /баланс /участники /перевод\n\nЗаслуги — не деньги.`,
  groupWelcome: (name: string) =>
    `Meriter подключён к «${name}». Голосуйте реакциями на посты бота и сообщения с хэштегом. Команды: /баланс /участники /перевод /post`,
  botRemovedAdmin:
    'Бот удалён из группы. Сообщество заморожено — траты и начисления заслуг остановлены.',
  help:
    'Команды:\n/баланс — ваш баланс\n/участники — рейтинг с %\n/фонд — общий фонд\n/перевод @user N — перевод\n/перевод N (ответ на сообщение) — перевод\n/post текст — опубликовать пост (лид)\n/help — справка',
  postPublished: 'Пост опубликован.',
  enterAmount: 'Введите количество заслуг (число):',
  cancelled: 'Отменено.',
  unknownCommand: 'Не понял команду. /help — справка.',
} as const;

export const TG_EMOJI = {
  up: '👍',
  upAlt: '👍🏻',
  heart: '❤',
  heartFull: '❤️',
  down: '🤡',
} as const;
