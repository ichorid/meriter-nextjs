import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const INTEGER_RUBLES_MESSAGE = 'Введите целое число рублей';

const DEAL_STATUS_LABELS: Record<string, string> = {
  requested: 'Ждёт ответа',
  accepted: 'В работе',
  completed_by_seller: 'Ждёт подтверждения',
  closed: 'Завершена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
  expired: 'Истекла',
};

export function reportUnknownDealStatus(status: string): void {
  console.warn('uzz.unknown_deal_status', status);
}

export function dealStatusLabel(status: string, role?: 'buyer' | 'seller' | 'other'): string {
  if (role === 'seller') {
    if (status === 'requested') return 'Новая заявка — нужен ваш ответ';
    if (status === 'accepted') return 'В работе — отметьте, когда выполните';
    if (status === 'completed_by_seller') return 'Ждём подтверждения заказчика';
  }
  if (role === 'buyer') {
    if (status === 'requested') return 'Ждём ответа исполнителя';
    if (status === 'accepted') return 'Исполнитель взял заявку в работу';
    if (status === 'completed_by_seller') return 'Подтвердите выполнение';
  }
  const label = DEAL_STATUS_LABELS[status];
  if (label) return label;
  reportUnknownDealStatus(status);
  return 'Неизвестный статус';
}

/**
 * The Telegram name comes first, the login stays visible next to it as an
 * anti-phishing anchor. When the profile has no separate name, the login
 * alone is shown once.
 */
export function userLabelParts(
  rawName: string | null | undefined,
  rawUsername: string | null | undefined,
): { name: string; username: string | null } {
  const name = rawName?.trim() || '';
  const username = rawUsername?.trim().replace(/^@/, '') || null;
  if (!name && !username) return { name: 'Участник сообщества', username: null };
  if (!name) return { name: `@${username}`, username: null };
  if (username && name.toLocaleLowerCase() === username.toLocaleLowerCase()) {
    return { name: `@${username}`, username: null };
  }
  return { name, username };
}

/** Same as userLabelParts, flattened to plain text: «Имя (@логин)». */
export function userLabelText(
  rawName: string | null | undefined,
  rawUsername: string | null | undefined,
): string {
  const { name, username } = userLabelParts(rawName, rawUsername);
  return username ? `${name} (@${username})` : name;
}

export function formatSignedRub(value: number): string {
  const abs = Math.abs(value).toLocaleString('ru-RU');
  if (value > 0) return `+${abs} ₽`;
  if (value < 0) return `−${abs} ₽`;
  return '0 ₽';
}

export function parseIntegerRubles(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function bankStatusLabel(status: string): string {
  return ({ awaiting_nominal: 'Администратор назначает номинал', active: 'Можно обменивать', in_deal: 'Зарезервировано в сделке', exhausted: 'Переходы закончились', holding: 'Нужно завершить привязку профиля' } as Record<string, string>)[status] ?? 'Статус обновлён';
}

export function ledgerTypeLabel(type: string): string {
  return ({ right_emitted: 'Появился банк на обмен', bank_emitted: 'Появился банк на обмен', rights_backfilled: 'Выдача банков за прошлые дела', nominal_assigned: 'Назначен номинал', right_nominal_assigned: 'Назначен номинал', bank_nominal_set: 'Назначен номинал', right_sent: 'Банк передан', right_received: 'Банк получен', right_transferred: 'Банк перешёл новому владельцу', bank_transferred: 'Банк перешёл новому владельцу', right_demurrage_applied: 'Номинал уменьшился', demurrage: 'Номинал уменьшился', deal_requested: 'Создана заявка', fee_reserved: 'Комиссия зарезервирована', deal_fee_reserved: 'Комиссия зарезервирована', fee_refunded: 'Комиссия возвращена', deal_fee_refunded: 'Комиссия возвращена', deal_accepted: 'Заявка принята', deal_rejected: 'Заявка отклонена', deal_completed: 'Исполнитель отметил выполнение', deal_completed_by_seller: 'Исполнитель отметил выполнение', deal_closed: 'Сделка закрыта', deal_cancelled: 'Сделка отменена', thanks_sent: 'Благодарность отправлена', thanks_received: 'Благодарность получена', deal_thanks: 'Благодарность', admin_resolution: 'Решение администратора', settings_updated: 'Изменены настройки' } as Record<string, string>)[type] ?? 'Операция';
}

export function bankHeadline(bank: { status: string; nominalRub: number | null; createdAt?: Date | string }): string {
  const since = bank.createdAt ? ` · с ${formatWhen(bank.createdAt)}` : '';
  return bank.nominalRub == null ? `Банк на обмен · номинал ещё не назначен${since}` : `Банк на обмен · сегодня до ${bank.nominalRub.toLocaleString('ru-RU')} ₽${since}`;
}
export function bankHopsLabel(hopsLeft: number): string { return `Осталось переходов: ${Math.max(0, hopsLeft)}`; }

export function meritsWord(n: number): string {
  const value = Math.abs(n);
  // Russian fractions take the genitive singular: «0,5 заслуги», not «0,5 заслуга».
  if (!Number.isInteger(value)) return 'заслуги';
  const mod10 = value % 10; const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заслуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заслуги';
  return 'заслуг';
}
export function meritsLabel(n: number): string { return `${n.toLocaleString('ru-RU')} ${meritsWord(n)}`; }

const LEDGER_REASON_LABELS: Record<string, string> = {
  expired: 'Заявка истекла по сроку',
  auto_close: 'Сделка закрыта автоматически по истечении срока подтверждения',
  emission: 'Эмиссия за доброе дело',
  emission_holding: 'Эмиссия: ждёт привязку профиля',
  auto_assign: 'Номинал назначен автоматически',
};

export function listingsWord(n: number): string {
  const value = Math.abs(n);
  const mod10 = value % 10; const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'услугу';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'услуги';
  return 'услуг';
}

export function ledgerReasonLabel(reason: string): string {
  return LEDGER_REASON_LABELS[reason] ?? reason;
}
export function feeSourceFromWallet(wallet: unknown): 'community' | 'global' | null { return wallet === 'community' || wallet === 'global' ? wallet : null; }
export function feeWalletPhrase(source: 'community' | 'global' | null | undefined): string { return source === 'community' ? 'кошелёк сообщества' : source === 'global' ? 'общий кошелёк' : ''; }
export function feeChargedCopy(source: 'community' | 'global' | null | undefined, amount = 1): string { return `Списано ${meritsLabel(amount)}: ${feeWalletPhrase(source) || 'кошелёк'}`; }
export function feeReservedCopy(source: 'community' | 'global' | null | undefined, amount = 1): string { return `Зарезервировано ${meritsLabel(amount)}: ${feeWalletPhrase(source) || 'кошелёк'}`; }
export function walletSourceLabel(sourceCommunityId: unknown, communityId: string): string | null {
  if (typeof sourceCommunityId !== 'string' || !sourceCommunityId) return null;
  return sourceCommunityId === communityId ? 'кошелёк сообщества' : 'общий кошелёк';
}

export function linkGap(status: { linked?: boolean; telegramUserId?: string | null; email?: string | null } | null | undefined): 'telegram' | 'email' | null {
  if (!status || status.linked) return null;
  if (!status.telegramUserId) return 'telegram';
  if (!status.email) return 'email';
  return null;
}

const RETURN_TO_KEY = 'uzz_return_to'; const SESSION_KEY = 'uzz_had_session';
const SAME_ORIGIN_BASE = 'https://uzz.invalid';

function hasBackslashOrControl(value: string): boolean {
  if (value.includes('\\') || /%5c/i.test(value)) return true;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function parseSafeAppPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (hasBackslashOrControl(value) || !value.startsWith('/') || value.startsWith('//')) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (hasBackslashOrControl(decoded)) return null;
  let url: URL;
  try {
    url = new URL(value, SAME_ORIGIN_BASE);
  } catch {
    return null;
  }
  const base = new URL(SAME_ORIGIN_BASE);
  if (url.origin !== base.origin || url.username || url.password) return null;
  if (hasBackslashOrControl(url.href) || hasBackslashOrControl(url.pathname)) return null;
  const result = `${url.pathname}${url.search}${url.hash}`;
  if (!result.startsWith('/') || result.startsWith('//') || hasBackslashOrControl(result)) return null;
  return result;
}

export function safeAppPath(value: unknown, fallback = '/'): string {
  return parseSafeAppPath(value) ?? fallback;
}
export function isSafeAppPath(path: string): boolean { return parseSafeAppPath(path) !== null; }
export function rememberReturnTo(path: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETURN_TO_KEY, safeAppPath(path, '/'));
}
export function consumeReturnTo(): string {
  if (typeof window === 'undefined') return '/';
  const value = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  return safeAppPath(value, '/');
}
export function markUzzSession(): void { if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, '1'); }
export function clearUzzSessionFlag(): void { if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY); }
export function hadUzzSession(): boolean { return typeof window !== 'undefined' && localStorage.getItem(SESSION_KEY) === '1'; }

export function tomorrowNominal(nominalRub: number | null, demurrageRubPerDay: number, floorRub: number): number | null {
  if (nominalRub == null) return null;
  const reduced = Math.max(1, nominalRub - demurrageRubPerDay);
  return nominalRub >= floorRub ? Math.max(floorRub, reduced) : reduced;
}
export function formatDeadline(value: Date | string | null | undefined): string | null {
  if (!value) return null; const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return 'Срок истёк';
  const hours = Math.floor(ms / 3_600_000); if (hours < 1) return 'Осталось меньше часа'; if (hours < 48) return `Осталось ${hours} ч`;
  return `Осталось ${Math.ceil(hours / 24)} дн.`;
}
export function formatWhen(value: Date | string | undefined): string { return value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
export function isDeadlinePassed(value: Date | string | null | undefined): boolean { return Boolean(value && new Date(value).getTime() <= Date.now()); }
export function isUnauthorizedError(error: unknown): boolean { if (!error || typeof error !== 'object') return false; const candidate = error as { data?: { code?: string }; message?: string }; return candidate.data?.code === 'UNAUTHORIZED' || candidate.message === 'UNAUTHORIZED'; }

/** Open a blank tab on the user click so an async deep link is not popup-blocked. */
export function openPendingExternalWindow(): Window | null {
  return window.open('about:blank', '_blank');
}

export function navigatePendingExternalWindow(pending: Window | null, url: string): boolean {
  if (pending && !pending.closed) {
    pending.location.replace(url);
    return true;
  }
  return window.open(url, '_blank', 'noopener,noreferrer') != null;
}

export function closePendingExternalWindow(pending: Window | null): void {
  if (pending && !pending.closed) pending.close();
}

export { uzzErrorMessage } from '@/lib/uzz-error-messages';

export function dealNeedsAction(deal: { status: string; myRole: 'buyer' | 'seller' | 'other' }): boolean {
  return (deal.status === 'requested' && deal.myRole === 'seller') || (deal.status === 'accepted' && deal.myRole === 'seller') || (deal.status === 'completed_by_seller' && deal.myRole === 'buyer');
}
