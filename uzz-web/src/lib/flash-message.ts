const REQUESTED_MESSAGES = {
  local: 'Заявка отправлена. Зарезервирована 1 заслуга с кошелька сообщества.',
  global: 'Заявка отправлена. Зарезервирована 1 заслуга с общего кошелька.',
} as const;

export type DealFlashParams = {
  get(name: string): string | null;
};

export function parseDealFlash(params: DealFlashParams): string | null {
  if (params.get('requested') !== '1') return null;
  const feeSource = params.get('feeSource');
  if (feeSource === 'local' || feeSource === 'global') {
    return REQUESTED_MESSAGES[feeSource];
  }
  return null;
}
