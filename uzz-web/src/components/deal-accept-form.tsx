'use client';

import { FormEvent, useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import {
  DEAL_DEADLINE_NOT_FUTURE_MESSAGE,
  instantToLocalInput,
  isDeadlineTooSoon,
  localInputToInstant,
  mapDeadlineError,
  minimumLocalDeadline,
} from '@/lib/local-datetime';

export function DealAcceptForm({
  currentNominalRub, requestedDeadlineAt, pending, error, onCancel, onAccept,
}: {
  currentNominalRub: number | null;
  requestedDeadlineAt?: Date | string | null;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onAccept: (deadline?: Date) => void;
}) {
  const [deadline, setDeadline] = useState(requestedDeadlineAt ? instantToLocalInput(requestedDeadlineAt) : '');
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const serverError = mapDeadlineError(error) ?? error;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (deadline && isDeadlineTooSoon(deadline)) {
      setDeadlineError(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
      return;
    }
    setDeadlineError(null);
    onAccept(deadline ? localInputToInstant(deadline) : undefined);
  }

  return <form noValidate onSubmit={submit} className="space-y-4">
    <Notice tone="warn"><strong>Проверьте номинал: {currentNominalRub?.toLocaleString('ru-RU') ?? '—'} ₽.</strong> Он тает каждый день, даже пока заявка открыта. Принятие фиксирует именно показанную сумму; если она успела измениться, система попросит подтвердить ещё раз.</Notice>
    <Field label="Согласованный срок" hint="Можно оставить пожелание заказчика или указать другой срок.">
      <input type="datetime-local" min={minimumLocalDeadline()} value={deadline} onChange={(event) => { setDeadline(event.target.value); setDeadlineError(null); }} className={inputClass} />
    </Field>
    {deadlineError ? <p role="alert" className="text-sm text-amber-200">{deadlineError}</p> : null}
    {serverError ? <Notice tone="warn">{serverError}</Notice> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={onCancel}>Назад</Button>
      <Button type="submit" disabled={pending || currentNominalRub == null}>{pending ? 'Проверяем…' : `Принять на ${currentNominalRub ?? '—'} ₽`}</Button>
    </div>
  </form>;
}
