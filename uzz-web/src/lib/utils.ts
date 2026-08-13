import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEAL_STATUS_RU: Record<string, string> = {
  requested: 'Ждёт ответа исполнителя',
  accepted: 'Исполнитель принял заявку',
  completed_by_seller: 'Исполнитель отметил «сделано» — подтвердите',
  closed: 'Сделка завершена',
  rejected: 'Исполнитель отклонил заявку',
  cancelled: 'Отменена',
};

const BANK_STATUS_RU: Record<string, string> = {
  awaiting_nominal: 'Ждём номинал от администратора',
  active: 'Можно обменять',
  in_deal: 'Сейчас в сделке',
  exhausted: 'Право использовано',
  holding: 'Нужна привязка Telegram и почты',
};

const LEDGER_TYPE_RU: Record<string, string> = {
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

export function dealStatusLabel(status: string): string {
  return DEAL_STATUS_RU[status] ?? 'Статус обновлён';
}

export function bankStatusLabel(status: string): string {
  return BANK_STATUS_RU[status] ?? 'Статус обновлён';
}

export function ledgerTypeLabel(type: string): string {
  return LEDGER_TYPE_RU[type] ?? 'Операция';
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
