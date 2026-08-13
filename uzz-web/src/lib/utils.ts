import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

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
  return ({ requested: 'Ждёт ответа', accepted: 'В работе', completed_by_seller: 'Ждёт подтверждения', closed: 'Завершена', rejected: 'Отклонена', cancelled: 'Отменена' } as Record<string, string>)[status] ?? 'Статус обновлён';
}

export function bankStatusLabel(status: string): string {
  return ({ awaiting_nominal: 'Администратор назначает номинал', active: 'Можно обменивать', in_deal: 'Зарезервировано в сделке', exhausted: 'Переходы закончились', holding: 'Нужно завершить привязку профиля' } as Record<string, string>)[status] ?? 'Статус обновлён';
}

export function ledgerTypeLabel(type: string): string {
  return ({ right_emitted: 'Появилось право на обмен', bank_emitted: 'Появилось право на обмен', right_nominal_assigned: 'Назначен номинал', bank_nominal_set: 'Назначен номинал', right_transferred: 'Право перешло новому владельцу', bank_transferred: 'Право перешло новому владельцу', right_demurrage_applied: 'Номинал уменьшился', demurrage: 'Номинал уменьшился', deal_requested: 'Создана заявка', deal_fee_reserved: 'Комиссия зарезервирована', deal_fee_refunded: 'Комиссия возвращена', deal_accepted: 'Заявка принята', deal_rejected: 'Заявка отклонена', deal_completed_by_seller: 'Исполнитель отметил выполнение', deal_closed: 'Сделка закрыта', deal_cancelled: 'Сделка отменена', deal_thanks: 'Отправлена благодарность', settings_updated: 'Изменены настройки' } as Record<string, string>)[type] ?? 'Операция';
}

export function bankHeadline(bank: { status: string; nominalRub: number | null; createdAt?: Date | string }): string {
  const since = bank.createdAt ? ` · с ${formatWhen(bank.createdAt)}` : '';
  return bank.nominalRub == null ? `Право на обмен · номинал ещё не назначен${since}` : `Право на обмен · сегодня до ${bank.nominalRub.toLocaleString('ru-RU')} ₽${since}`;
}
export function bankHopsLabel(hopsLeft: number): string { return `Осталось переходов: ${Math.max(0, hopsLeft)}`; }

export function meritsWord(n: number): string {
  const value = Math.abs(Math.round(n));
  const mod10 = value % 10; const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заслуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заслуги';
  return 'заслуг';
}
export function meritsLabel(n: number): string { return `${n} ${meritsWord(n)}`; }
export function feeSourceFromWallet(wallet: unknown): 'community' | 'global' | null { return wallet === 'community' || wallet === 'global' ? wallet : null; }
export function feeWalletPhrase(source: 'community' | 'global' | null | undefined): string { return source === 'community' ? 'кошелёк сообщества' : source === 'global' ? 'общий кошелёк' : ''; }
export function feeChargedCopy(source: 'community' | 'global' | null | undefined, amount = 1): string { return `Списано ${meritsLabel(amount)}: ${feeWalletPhrase(source) || 'кошелёк'}`; }
export function feeReservedCopy(source: 'community' | 'global' | null | undefined, amount = 1): string { return `Зарезервировано ${meritsLabel(amount)}: ${feeWalletPhrase(source) || 'кошелёк'}`; }

export function linkGap(status: { linked?: boolean; telegramUserId?: string | null; email?: string | null } | null | undefined): 'telegram' | 'email' | null {
  if (!status || status.linked) return null;
  if (!status.telegramUserId) return 'telegram';
  if (!status.email) return 'email';
  return null;
}

const RETURN_TO_KEY = 'uzz_return_to'; const SESSION_KEY = 'uzz_had_session';
export function isSafeAppPath(path: string): boolean { return path.startsWith('/') && !path.startsWith('//') && !path.includes('://'); }
export function rememberReturnTo(path: string): void { if (typeof window !== 'undefined' && isSafeAppPath(path)) sessionStorage.setItem(RETURN_TO_KEY, path); }
export function consumeReturnTo(): string { if (typeof window === 'undefined') return '/'; const value = sessionStorage.getItem(RETURN_TO_KEY); sessionStorage.removeItem(RETURN_TO_KEY); return value && isSafeAppPath(value) ? value : '/'; }
export function markUzzSession(): void { if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, '1'); }
export function clearUzzSessionFlag(): void { if (typeof window !== 'undefined') localStorage.removeItem(SESSION_KEY); }
export function hadUzzSession(): boolean { return typeof window !== 'undefined' && localStorage.getItem(SESSION_KEY) === '1'; }

export function tomorrowNominal(nominalRub: number | null, demurrageRubPerDay: number, floorRub: number): number | null { return nominalRub == null ? null : Math.max(floorRub, nominalRub - demurrageRubPerDay); }
export function formatDeadline(value: Date | string | null | undefined): string | null {
  if (!value) return null; const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return 'Срок истёк';
  const hours = Math.floor(ms / 3_600_000); if (hours < 1) return 'Осталось меньше часа'; if (hours < 48) return `Осталось ${hours} ч`;
  return `Осталось ${Math.ceil(hours / 24)} дн.`;
}
export function formatWhen(value: Date | string | undefined): string { return value ? new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
export function isDeadlinePassed(value: Date | string | null | undefined): boolean { return Boolean(value && new Date(value).getTime() <= Date.now()); }
export function isUnauthorizedError(error: unknown): boolean { if (!error || typeof error !== 'object') return false; const candidate = error as { data?: { code?: string }; message?: string }; return candidate.data?.code === 'UNAUTHORIZED' || candidate.message === 'UNAUTHORIZED'; }

export function uzzErrorMessage(err: { message?: string } | null | undefined): string {
  const message = err?.message?.trim() || '';
  const labels: Record<string, string> = {
    UNAUTHORIZED: 'Нужно войти по ссылке из письма', FORBIDDEN: 'Для этого действия недостаточно прав',
    LISTING_TITLE_INVALID: 'Название должно содержать от 3 до 120 символов', LISTING_PRICE_INVALID: 'Укажите положительную цену',
    DEAL_REQUEST_MESSAGE_INVALID: 'Напишите исполнителю, что именно вам нужно', RIGHT_NOMINAL_CHANGED: 'Номинал изменился. Проверьте новую сумму и подтвердите принятие ещё раз',
    RIGHT_NOT_ACTIVE: 'Это право сейчас нельзя использовать', PURCHASE_GATE_BLOCKED: 'Сначала добавьте свои предложения', INSUFFICIENT_MERITS: 'Не хватает заслуг для комиссии',
    'Invalid or expired login link': 'Ссылка недействительна или устарела', 'Email authentication is not enabled': 'Вход по почте сейчас недоступен',
  };
  if (labels[message]) return labels[message];
  if (/[А-Яа-яЁё]/.test(message)) return message;
  return 'Не получилось выполнить действие. Обновите данные и попробуйте ещё раз.';
}

export function dealNeedsAction(deal: { status: string; myRole: 'buyer' | 'seller' | 'other' }): boolean {
  return (deal.status === 'requested' && deal.myRole === 'seller') || (deal.status === 'accepted' && deal.myRole === 'seller') || (deal.status === 'completed_by_seller' && deal.myRole === 'buyer');
}
