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
  hopsLeft: number;
}): string {
  const exchanges = Math.max(0, bank.hopsLeft);
  if (bank.nominalRub == null) {
    return `Право на обмен · номинал ещё не назначен · ещё ${exchanges} обменов`;
  }
  return `Право на обмен · сегодня до ${bank.nominalRub} ₽ · ещё ${exchanges} обменов`;
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
  if (ms <= 0) return 'Срок истекает';
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
    const thanked =
      deal.myRole === 'buyer' ? Boolean(deal.buyerThankedAt) : Boolean(deal.sellerThankedAt);
    return !thanked && deal.myRole !== 'other';
  }
  return false;
}
