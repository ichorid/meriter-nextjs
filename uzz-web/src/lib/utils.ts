import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEAL_STATUS_RU: Record<string, string> = {
  requested: 'запрос',
  accepted: 'принята',
  completed_by_seller: 'исполнена продавцом',
  closed: 'закрыта',
  rejected: 'отклонена',
  cancelled: 'отменена',
};

const BANK_STATUS_RU: Record<string, string> = {
  awaiting_nominal: 'ожидает номинал',
  active: 'активен',
  in_deal: 'в сделке',
  exhausted: 'исчерпан',
  holding: 'удержание (нет связки)',
};

export function dealStatusLabel(status: string): string {
  return DEAL_STATUS_RU[status] ?? status;
}

export function bankStatusLabel(status: string): string {
  return BANK_STATUS_RU[status] ?? status;
}
