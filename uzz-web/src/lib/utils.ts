import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dealStatusLabel(
  status: string,
  role?: 'buyer' | 'seller' | 'other',
): string {
  if (role === 'seller') {
    if (status === 'requested') return 'Вам написали — ответьте';
    if (status === 'accepted') return 'Сделайте услугу и отметьте «Сделано»';
    if (status === 'completed_by_seller') return 'Ждём подтверждения заказчика';
  }
  if (role === 'buyer') {
    if (status === 'requested') return 'Ждём ответа исполнителя';
    if (status === 'accepted') return 'Исполнитель взял заявку в работу';
    if (status === 'completed_by_seller') return 'Подтвердите, что всё сделано';
  }
  const fallback: Record<string, string> = {
    requested: 'Ждёт ответа',
    accepted: 'В работе',
    completed_by_seller: 'Ждёт подтверждения',
    closed: 'Завершена',
    rejected: 'Отклонена',
    cancelled: 'Отменена',
  };
  return fallback[status] ?? 'Статус обновлён';
}

export function bankStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    awaiting_nominal: 'Администратор ещё назначит потолок в рублях',
    active: 'Можно обменять',
    in_deal: 'Сейчас в сделке',
    exhausted: 'Право использовано',
    holding: 'Сначала привяжите Telegram и почту',
  };
  return labels[status] ?? 'Статус обновлён';
}

export function ledgerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bank_emitted: 'Появилось право на обмен',
    bank_nominal_set: 'Назначен номинал',
    bank_transferred: 'Право на обмен перешло',
    bank_exhausted: 'Право на обмен исчерпано',
    demurrage: 'Номинал подтаял',
    deal_requested: 'Заявка на услугу',
    deal_fee_reserved: 'Комиссия сделки зарезервирована',
    deal_fee_refunded: 'Комиссия возвращена',
    deal_accepted: 'Заявка принята',
    deal_rejected: 'Заявка отклонена',
    deal_completed_by_seller: 'Исполнитель отметил «сделано»',
    deal_closed: 'Сделка закрыта',
    deal_cancelled: 'Сделка отменена',
    deal_thanks: 'Благодарность',
    settings_updated: 'Настройки площадки',
  };
  return labels[type] ?? 'Операция';
}

export function bankHeadline(bank: {
  status: string;
  nominalRub: number | null;
  hopsLeft?: number;
  createdAt?: Date | string;
}): string {
  const since = bank.createdAt ? ` · с ${formatWhen(bank.createdAt)}` : '';
  if (bank.nominalRub == null) {
    return `Право на обмен · номинал ещё не назначен${since}`;
  }
  return `Право на обмен · сегодня до ${bank.nominalRub} ₽${since}`;
}

export function bankHopsLabel(hopsLeft: number): string {
  return `осталось обменов: ${Math.max(0, hopsLeft)}`;
}

export function meritsWord(n: number): string {
  const abs = Math.abs(Math.round(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заслуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заслуги';
  return 'заслуг';
}

export function meritsLabel(n: number): string {
  return `${n} ${meritsWord(n)}`;
}

export function feeSourceFromWallet(
  wallet: unknown,
): 'community' | 'global' | null {
  if (wallet === 'community' || wallet === 'global') return wallet;
  return null;
}

export function feeChargedCopy(
  source: 'community' | 'global' | null | undefined,
  amount = 1,
): string {
  if (source === 'community') {
    return `Списана ${meritsLabel(amount)} с кошелька сообщества`;
  }
  if (source === 'global') {
    return `Списана ${meritsLabel(amount)} с общего кошелька`;
  }
  return `Списана ${meritsLabel(amount)}`;
}

export function feeReservedCopy(
  source: 'community' | 'global' | null | undefined,
  amount = 1,
): string {
  if (source === 'community') {
    return `Зарезервирована ${meritsLabel(amount)} с кошелька сообщества`;
  }
  if (source === 'global') {
    return `Зарезервирована ${meritsLabel(amount)} с общего кошелька`;
  }
  return `Зарезервирована ${meritsLabel(amount)}`;
}

export function feeWalletPhrase(
  source: 'community' | 'global' | null | undefined,
): string {
  if (source === 'community') return 'кошелёк сообщества';
  if (source === 'global') return 'общий кошелёк';
  return '';
}

export function linkGap(
  status?: { linked?: boolean; telegramUserId?: string; email?: string } | null,
): 'telegram' | 'email' | null {
  if (!status || status.linked) return null;
  return status.telegramUserId ? 'email' : 'telegram';
}

const RETURN_TO_KEY = 'uzz-return-to';
const HAD_SESSION_KEY = 'uzz-had-session';

export function isSafeAppPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path === '/login' || path.startsWith('/login?') || path.startsWith('/login/')) {
    return false;
  }
  if (path === '/a' || path.startsWith('/a/')) return false;
  return true;
}

export function rememberReturnTo(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeAppPath(path)) return;
  sessionStorage.setItem(RETURN_TO_KEY, path);
}

export function consumeReturnTo(): string {
  if (typeof window === 'undefined') return '/catalog';
  const stored = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  if (stored && isSafeAppPath(stored)) return stored;
  return '/catalog';
}

export function markUzzSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(HAD_SESSION_KEY, '1');
}

export function clearUzzSessionFlag(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HAD_SESSION_KEY);
}

export function hadUzzSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(HAD_SESSION_KEY) === '1';
}

export function tomorrowNominal(
  nominalRub: number | null,
  demurrageRubPerDay: number,
  floorRub: number,
): number | null {
  if (nominalRub == null) return null;
  return Math.max(floorRub, nominalRub - demurrageRubPerDay);
}

export function formatDeadline(expiresAt: Date | string | null | undefined): string | null {
  if (!expiresAt) return null;
  const at = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const ms = at.getTime() - Date.now();
  if (ms <= 0) return 'Срок истёк';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'Осталось меньше часа';
  if (hours < 48) return `Осталось ${hours} ч`;
  const days = Math.ceil(hours / 24);
  return `Осталось ${days} дн.`;
}

export function formatWhen(value: Date | string | undefined): string {
  if (!value) return '';
  const at = typeof value === 'string' ? new Date(value) : value;
  return at.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDeadlinePassed(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const at = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return at.getTime() <= Date.now();
}

export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const data = (error as { data?: { code?: string } }).data;
  const message = (error as { message?: string }).message;
  return data?.code === 'UNAUTHORIZED' || message === 'UNAUTHORIZED';
}

export function uzzErrorMessage(err: { message?: string } | null | undefined): string {
  const message = err?.message?.trim() || '';
  if (!message) return 'Не получилось. Попробуйте ещё раз.';
  if (/[А-Яа-яЁё]/.test(message)) return message;
  const mapped: Record<string, string> = {
    'You must be logged in to access this resource': 'Нужно войти',
    'Email already linked to another user': 'Эта почта уже привязана к другому аккаунту',
    'title is required': 'Укажите название услуги',
    'priceRub must be positive': 'Укажите цену в рублях',
    'Bank not found': 'Право на обмен не найдено',
    'Deal not found': 'Сделка не найдена',
    'Invalid or expired login link': 'Ссылка недействительна или устарела',
    'Email authentication is not enabled': 'Вход по почте сейчас выключен',
    UNAUTHORIZED: 'Нужно войти',
    FORBIDDEN: 'Недостаточно прав',
  };
  return mapped[message] ?? 'Не получилось. Попробуйте ещё раз.';
}

export function dealNeedsAction(deal: {
  status: string;
  myRole: 'buyer' | 'seller' | 'other';
  buyerThankedAt?: Date | string | null;
  sellerThankedAt?: Date | string | null;
}): boolean {
  if (deal.status === 'requested' && deal.myRole === 'seller') return true;
  if (deal.status === 'accepted' && deal.myRole === 'seller') return true;
  if (deal.status === 'completed_by_seller' && deal.myRole === 'buyer') return true;
  if (deal.status === 'closed') {
    return false;
  }
  return false;
}
