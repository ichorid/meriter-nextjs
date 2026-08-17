'use client';

import { FormEvent, useState } from 'react';
import { DeadlinePicker } from '@/components/deadline-picker';
import { Button, Notice, userContentClass } from '@/components/ui';
import { DEAL_DEADLINE_NOT_FUTURE_MESSAGE, isInstantTooSoon } from '@/lib/local-datetime';
import { cn, formatSignedRub, uzzErrorMessage } from '@/lib/utils';

function formatInstant(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString('ru-RU');
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function DealAcceptForm({
  listingPriceRub, currentNominalRub, demurrageRubPerDay, requestMessage,
  requestedDeadlineAt, agreedDeadlineAt, pending, error, onCancel, onAccept,
}: {
  listingPriceRub?: number;
  currentNominalRub: number | null;
  demurrageRubPerDay?: number;
  requestMessage?: string;
  requestedDeadlineAt?: Date | string | null;
  agreedDeadlineAt?: Date | string | null;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onAccept: (deadline?: Date) => void;
}) {
  const [deadline, setDeadline] = useState<Date | null>(toDate(agreedDeadlineAt ?? requestedDeadlineAt));
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const serverError = error ? uzzErrorMessage({ message: error }) : null;
  const difference = listingPriceRub != null && currentNominalRub != null ? currentNominalRub - listingPriceRub : null;
  const belowPrice = difference != null && difference < 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (deadline && isInstantTooSoon(deadline)) {
      setDeadlineError(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
      return;
    }
    setDeadlineError(null);
    onAccept(deadline ?? undefined);
  }

  return <form noValidate onSubmit={submit} className="space-y-4">
    <dl className="grid min-w-0 gap-3 rounded-xl bg-stitch-canvas/50 p-4 text-sm sm:grid-cols-2">
      {listingPriceRub != null ? <div><dt className="text-xs text-stitch-muted">Цена услуги</dt><dd className="font-semibold">{listingPriceRub.toLocaleString('ru-RU')} ₽</dd></div> : null}
      <div><dt className="text-xs text-stitch-muted">Текущий номинал</dt><dd className="font-semibold">{currentNominalRub?.toLocaleString('ru-RU') ?? '—'}{currentNominalRub != null ? ' ₽' : ''}</dd></div>
      {difference != null ? <div><dt className="text-xs text-stitch-muted">Разница</dt><dd className="font-semibold">{formatSignedRub(difference)}</dd></div> : null}
      <div><dt className="text-xs text-stitch-muted">Таяние</dt><dd className="font-semibold">{demurrageRubPerDay != null ? `${demurrageRubPerDay.toLocaleString('ru-RU')} ₽ в день` : 'Загружаем условия…'}</dd></div>
      {requestMessage ? <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-stitch-muted">Сообщение</dt><dd className={cn('whitespace-pre-wrap leading-6', userContentClass)}>{requestMessage}</dd></div> : null}
      <div><dt className="text-xs text-stitch-muted">Желаемый срок</dt><dd>{formatInstant(requestedDeadlineAt) ?? 'не указан'}</dd></div>
      <div><dt className="text-xs text-stitch-muted">Согласованный срок</dt><dd>{formatInstant(agreedDeadlineAt) ?? 'ещё не зафиксирован'}</dd></div>
    </dl>
    <Notice tone="warn">Номинал тает каждый день, даже пока заявка открыта. Принятие фиксирует показанную сумму; если она успела измениться, система попросит подтвердить ещё раз.</Notice>
    {belowPrice ? <Notice tone="warn">Текущий номинал ниже цены услуги. Принять заявку всё равно можно: банк перейдёт целиком.</Notice> : null}
    <DeadlinePicker
      id="deal-accept-deadline"
      label="Согласованный срок"
      hint="Можно оставить пожелание заказчика, выбрать другой срок или сбросить поле."
      value={deadline}
      onChange={(next) => { setDeadline(next); setDeadlineError(null); }}
    />
    {deadlineError ? <p role="alert" className="text-sm text-amber-200">{deadlineError}</p> : null}
    {serverError ? <Notice tone="warn">{serverError}</Notice> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel}>Назад</Button>
      <Button type="submit" disabled={pending || currentNominalRub == null}>{pending ? 'Проверяем…' : `Принять на ${currentNominalRub ?? '—'} ₽`}</Button>
    </div>
  </form>;
}
