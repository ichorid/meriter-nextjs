import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE } from '@/lib/local-datetime';

export const UZZ_UNKNOWN_ERROR_MESSAGE =
  'Не получилось выполнить действие. Обновите данные и попробуйте ещё раз.';

export const UZZ_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Нужно войти по ссылке из письма',
  FORBIDDEN: 'Для этого действия недостаточно прав',
  NOT_FOUND: 'Нужная запись не найдена. Обновите страницу',
  CONFLICT: 'Данные уже изменились. Обновите страницу и попробуйте ещё раз',
  TOO_MANY_REQUESTS: 'Слишком много попыток. Подождите немного и попробуйте снова',
  INTERNAL_SERVER_ERROR: 'Сервер не смог выполнить действие. Попробуйте ещё раз через минуту',
  BAD_REQUEST: 'Проверьте поля формы и попробуйте ещё раз',
  INVALID_INPUT: 'Проверьте поля формы: данные не прошли проверку',
  UZZ_RATE_LIMITED: 'Слишком много попыток. Подождите немного и попробуйте снова',
  EMAIL_DELIVERY_UNAVAILABLE: 'Не удалось отправить письмо. Попробуйте ещё раз через минуту',
  'Email authentication is not enabled': 'Вход по почте сейчас недоступен',
  'Invalid or expired login link': 'Ссылка недействительна или устарела',
  'Email identity conflicts with another account':
    'Этот email уже связан с другим аккаунтом. Войдите тем адресом, которым пользовались раньше',
  'User not found': 'Пользователь не найден. Войдите по ссылке из письма ещё раз',
  'Community not found': 'Сообщество не найдено. Обратитесь к администратору',
  'You must be logged in to access this resource': 'Нужно войти по ссылке из письма',
  'Fake data mode or test auth mode is not enabled': 'Тестовый вход сейчас выключен',

  IDENTITY_LINK_REQUIRED: 'Сначала привяжите Telegram в профиле',
  IDENTITY_NOT_FOUND: 'Профиль входа не найден. Войдите по ссылке из письма ещё раз',
  IDENTITY_CONFLICT: 'Этот Telegram или email уже связан с другим аккаунтом',
  IDENTITY_TOKEN_INVALID: 'Ссылка привязки Telegram недействительна или устарела. Запросите новую',
  MAGIC_LINK_INVALID: 'Ссылка недействительна или устарела',
  MAGIC_LINK_CLAIM_LOST: 'Ссылку уже использовали. Запросите новое письмо для входа',

  COMMUNITY_MEMBERSHIP_REQUIRED:
    'Публиковать и меняться услугами можно только участникам выбранного сообщества. Вступите в его Telegram-чат',
  COMMUNITY_ADMIN_REQUIRED: 'Это действие доступно только администратору сообщества',
  COMMUNITY_ID_REQUIRED: 'Выберите сообщество',
  COMMUNITY_NOT_FOUND: 'Сообщество не найдено. Обратитесь к администратору',
  COMMUNITY_MISMATCH: 'Банк и объявление относятся к разным сообществам',
  PILOT_COMMUNITY_NOT_MEMBER: 'Можно выбрать только сообщество, в котором вы состоите',
  PILOT_COMMUNITY_NOT_TELEGRAM: 'Можно выбрать только Telegram-чат с подключённым ботом',
  PUBLICATION_NOT_FOUND: 'Доброе дело не найдено',

  LISTING_TITLE_INVALID: 'Название должно содержать от 3 до 120 символов',
  LISTING_PRICE_INVALID: 'Укажите положительную цену',
  LISTING_DESCRIPTION_INVALID: 'Описание слишком длинное — сократите до 2000 символов',
  LISTING_LOCATION_INVALID: 'Место слишком длинное — сократите до 160 символов',
  LISTING_DURATION_INVALID: 'Длительность слишком длинная — сократите до 120 символов',
  LISTING_AVAILABILITY_INVALID: 'Доступность слишком длинная — сократите до 500 символов',
  LISTING_DELIVERY_MODE_INVALID: 'Выберите формат: онлайн, очно или оба варианта',
  LISTING_NOT_FOUND: 'Объявление не найдено или уже скрыто',
  LISTING_AUTHOR_REQUIRED: 'Изменять объявление может только автор',
  LISTING_ID_INVALID: 'Некорректный идентификатор объявления',
  LISTING_COMMUNITY_ID_INVALID: 'Некорректное сообщество объявления',
  LISTING_AUTHOR_ID_INVALID: 'Некорректный автор объявления',
  LISTING_VERSION_INVALID: 'Объявление изменилось. Обновите страницу',
  LISTING_PRICE_EXCEEDS_NOMINAL: 'Цена объявления больше номинала выбранного банка',
  MIN_LISTINGS_REQUIRED: 'Сначала добавьте свои предложения',
  PURCHASE_GATE_BLOCKED: 'Сначала добавьте свои предложения',
  PURCHASE_GATE_INPUT_INVALID: 'Некорректные условия взаимности. Обновите страницу',

  RUBLES_INVALID: 'Укажите положительную цену целым числом рублей',
  MERIT_AMOUNT_INVALID: 'Сумма заслуг должна быть целым положительным числом',
  DEAL_DEADLINE_NOT_FUTURE: DEAL_DEADLINE_NOT_FUTURE_MESSAGE,
  DEAL_REQUEST_MESSAGE_INVALID: 'Напишите исполнителю, что именно вам нужно',
  DEAL_SELF_REQUEST_FORBIDDEN: 'Нельзя заказать собственную услугу',
  DEAL_NOT_FOUND: 'Сделка не найдена. Обновите список',
  DEAL_STATUS_INVALID: 'Это действие сейчас недоступно для статуса сделки',
  DEAL_CANNOT_CANCEL: 'После принятия заказчик не может отменить сделку',
  DEAL_CANNOT_ADMIN_CLOSE: 'Администратор не может закрыть сделку в этом статусе',
  DEAL_NOT_DUE: 'Срок ещё не истёк — дождитесь дедлайна или дождитесь действия участника',
  DEAL_ACTOR_FORBIDDEN: 'Это действие может выполнить только участник сделки',
  DEAL_PARTICIPANT_REQUIRED: 'Действие доступно только участникам этой сделки',
  DEAL_SELLER_REQUIRED: 'Принять заявку может только исполнитель',
  DEAL_REQUEST_EXPIRED: 'Срок ответа на заявку истёк',
  DEAL_FULFILLMENT_EXPIRED: 'Срок исполнения сделки истёк',
  DEAL_THANKS_EMPTY: 'Напишите благодарность или укажите, за что благодарите',
  DEAL_THANKS_COMMENT_INVALID: 'Текст благодарности слишком длинный',
  DEAL_BUYER_ALREADY_THANKED: 'Заказчик уже отправил благодарность',
  DEAL_SELLER_ALREADY_THANKED: 'Исполнитель уже отправил благодарность',
  DEAL_FEE_ALREADY_RESERVED: 'Комиссия по этой сделке уже зарезервирована',
  DEAL_FEE_NOT_RESERVED: 'Комиссия по сделке не зарезервирована. Обновите страницу',
  DEAL_FEE_SOURCE_INVALID: 'Не удалось определить кошелёк для комиссии',
  DEAL_FEE_PAYER_INVALID: 'Не удалось определить, с кого списать комиссию',
  DEAL_ID_INVALID: 'Некорректный идентификатор сделки',
  DEAL_COMMUNITY_ID_INVALID: 'Некорректное сообщество сделки',
  DEAL_BUYER_ID_INVALID: 'Некорректный заказчик',
  DEAL_SELLER_ID_INVALID: 'Некорректный исполнитель',
  DEAL_LISTING_ID_INVALID: 'Некорректное объявление в сделке',
  DEAL_RIGHT_ID_INVALID: 'Некорректный банк в сделке',
  DEAL_REQUEST_EXPIRY_INVALID: 'Некорректный срок ответа на заявку',
  DEAL_FULFILLMENT_EXPIRY_INVALID: 'Некорректный срок исполнения',
  DEAL_CONFIRMATION_EXPIRY_INVALID: 'Некорректный срок подтверждения',
  DEAL_VERSION_INVALID: 'Сделка изменилась. Обновите страницу',
  DEAL_LISTING_DELIVERY_MODE_INVALID: 'Некорректный формат услуги в сделке',
  DEAL_LISTING_TITLE_INVALID: 'Название услуги в сделке повреждено. Обратитесь к администратору',
  DEAL_LISTING_LOCATION_INVALID: 'Место услуги в сделке указано некорректно',
  DEAL_CONTACT_INVALID: 'Контакт исполнителя ещё не готов',
  ADMIN_RESOLUTION_REASON_INVALID: 'Укажите причину решения администратора',

  RIGHT_NOT_ACTIVE: 'Этот банк сейчас нельзя использовать',
  RIGHT_NOT_FOUND: 'Банк на обмен не найден',
  RIGHT_OWNER_REQUIRED: 'Заявку можно отправить только своим банком',
  RIGHT_NOMINAL_MISSING: 'У банка ещё не назначен номинал',
  RIGHT_NOMINAL_CHANGED: 'Номинал изменился. Проверьте новую сумму и подтвердите принятие ещё раз',
  NOMINAL_CHANGED: 'Номинал изменился. Проверьте новую сумму и подтвердите принятие ещё раз',
  RIGHT_NOMINAL_ALREADY_ASSIGNED: 'Номинал этому банку уже назначен',
  RIGHT_NOMINAL_BELOW_FLOOR: 'Номинал не может быть ниже установленного минимума',
  RIGHT_NOT_DEMURRAGEABLE: 'Этот банк сейчас не тает',
  RIGHT_DEMURRAGE_CANNOT_INCREASE_NOMINAL: 'Таяние не может увеличить номинал',
  RIGHT_ALREADY_LOCKED: 'Банк уже занят другой сделкой',
  RIGHT_ALREADY_EXHAUSTED: 'У банка закончились переходы',
  RIGHT_DEAL_LOCK_MISMATCH: 'Банк привязан к другой сделке. Обновите страницу',
  RIGHT_ID_INVALID: 'Некорректный идентификатор банка',
  RIGHT_COMMUNITY_ID_INVALID: 'Некорректное сообщество банка',
  RIGHT_OWNER_ID_INVALID: 'Некорректный владелец банка',
  RIGHT_SOURCE_ID_INVALID: 'Некорректное доброе дело банка',
  RIGHT_HOPS_INVALID: 'Некорректное число переходов банка',
  RIGHT_VERSION_INVALID: 'Банк изменился. Обновите страницу',
  RIGHT_DEAL_LOCK_REQUIRED: 'Банк в сделке должен быть заблокирован',
  RIGHT_DEAL_LOCK_UNEXPECTED: 'Банк не должен быть заблокирован вне сделки',
  RIGHT_EXHAUSTED_WITH_HOPS: 'Исчерпанный банк не может иметь переходы',
  RIGHT_ZERO_HOPS_NOT_EXHAUSTED: 'Банк без переходов должен быть исчерпан',

  WALLET_INSUFFICIENT_FUNDS:
    'Недостаточно заслуг: нужна вся сумма либо в кошельке сообщества, либо в общем кошельке',
  INSUFFICIENT_MERITS:
    'Недостаточно заслуг: нужна вся сумма либо в кошельке сообщества, либо в общем кошельке',
  WALLET_NOT_FOUND: 'Кошелёк не найден. Обновите страницу или обратитесь к администратору',
  WALLET_RECIPIENT_NOT_FOUND: 'Кошелёк получателя не найден',
  WALLET_OPERATION_INVALID: 'Нельзя выполнить эту операцию с кошельком',

  SETTINGS_VALUE_INVALID: 'Проверьте значение настройки: оно вне допустимого диапазона',
  SETTINGS_DEFAULT_NOMINAL_BELOW_FLOOR:
    'Номинал по умолчанию не может быть ниже нижнего номинала',
  SETTINGS_PURCHASE_GATE_INVALID: 'Выберите режим взаимности: рекомендация или обязательный минимум',
  SETTINGS_VERSION_CONFLICT: 'Настройки уже изменились. Обновите страницу и сохраните снова',
  DEMURRAGE_INPUT_INVALID: 'Некорректные параметры таяния номинала',

  COMMAND_ID_CONFLICT: 'Повтор того же действия с другими данными. Обновите страницу и повторите',
  COMMAND_ALREADY_RUNNING: 'Это действие ещё выполняется. Подождите несколько секунд',
  UZZ_CONCURRENT_MODIFICATION: 'Данные уже изменились. Обновите страницу и попробуйте ещё раз',

  OUTBOX_LEASE_TOKEN_MISSING: 'Фоновая отправка не подтвердила захват задачи. Повторите позже',
  OUTBOX_TOPIC_UNSUPPORTED: 'Неизвестный тип фонового уведомления',
  OUTBOX_PAYLOAD_INVALID: 'Повреждённые данные уведомления. Обратитесь к администратору',
};

const CODE_LIKE = /^[A-Z][A-Z0-9_]{2,}$/;

export function uzzErrorCode(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err.trim();
  if (typeof err !== 'object') return String(err);
  const candidate = err as {
    message?: unknown;
    data?: { code?: unknown };
    shape?: { message?: unknown };
    cause?: { code?: unknown; message?: unknown };
  };
  const nestedCause =
    typeof candidate.cause?.code === 'string'
      ? candidate.cause.code
      : typeof candidate.cause?.message === 'string'
        ? candidate.cause.message
        : '';
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  if (message) return message;
  const shapeMessage =
    typeof candidate.shape?.message === 'string' ? candidate.shape.message.trim() : '';
  if (shapeMessage) return shapeMessage;
  if (nestedCause) return nestedCause.trim();
  return typeof candidate.data?.code === 'string' ? candidate.data.code.trim() : '';
}

function looksLikeZod(message: string): boolean {
  const trimmed = message.trim();
  return (
    /^invalid input$/i.test(trimmed) ||
    (trimmed.startsWith('[') && /"code"\s*:/.test(trimmed)) ||
    /too_small|too_big|invalid_type/i.test(trimmed)
  );
}

export function uzzErrorMessage(err: unknown): string {
  const raw = uzzErrorCode(err);
  if (!raw) return UZZ_UNKNOWN_ERROR_MESSAGE;
  if (UZZ_ERROR_MESSAGES[raw]) return UZZ_ERROR_MESSAGES[raw];
  if (looksLikeZod(raw)) return UZZ_ERROR_MESSAGES.INVALID_INPUT;
  if (/[А-Яа-яЁё]/.test(raw)) return raw;
  if (CODE_LIKE.test(raw)) {
    return `Не получилось выполнить действие (${raw}). Обновите данные и попробуйте ещё раз.`;
  }
  const dataCode =
    err && typeof err === 'object' && typeof (err as { data?: { code?: unknown } }).data?.code === 'string'
      ? (err as { data: { code: string } }).data.code
      : '';
  if (dataCode && UZZ_ERROR_MESSAGES[dataCode]) return UZZ_ERROR_MESSAGES[dataCode];
  return UZZ_UNKNOWN_ERROR_MESSAGE;
}
