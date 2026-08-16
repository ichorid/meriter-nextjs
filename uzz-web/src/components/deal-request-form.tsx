'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import {
  DEAL_DEADLINE_NOT_FUTURE_MESSAGE,
  isDeadlineTooSoon,
  localInputToInstant,
  mapDeadlineError,
  minimumLocalDeadline,
} from '@/lib/local-datetime';
import { tomorrowNominal } from '@/lib/utils';

interface RightOption { id: string; nominalRub: number | null; status: string; hopsLeft: number; }

export function DealRequestForm({
  title, priceRub, rights, pending, error, demurrageRubPerDay, nominalFloorRub,
  feeSourceLabel, onCancel, onSubmit,
}: {
  title: string; priceRub: number; rights: RightOption[]; pending: boolean; error?: string | null;
  demurrageRubPerDay?: number; nominalFloorRub?: number; feeSourceLabel?: string; onCancel: () => void;
  onSubmit: (data: { bankId: string; requestMessage: string; requestedDeadlineAt?: Date }) => void;
}) {
  const available = useMemo(() => rights.filter((right) => right.status === 'active' && (right.nominalRub ?? 0) >= priceRub), [priceRub, rights]);
  const [bankId, setBankId] = useState(available[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const selectedRight = available.find((right) => right.id === bankId);
  const settingsReady = demurrageRubPerDay != null && nominalFloorRub != null;
  const nominalTomorrow = settingsReady ? tomorrowNominal(selectedRight?.nominalRub ?? null, demurrageRubPerDay, nominalFloorRub) : null;
  const serverError = mapDeadlineError(error) ?? error;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!bankId || !message.trim()) return;
    if (deadline && isDeadlineTooSoon(deadline)) {
      setDeadlineError(DEAL_DEADLINE_NOT_FUTURE_MESSAGE);
      return;
    }
    setDeadlineError(null);
    onSubmit({ bankId, requestMessage: message.trim(), requestedDeadlineAt: deadline ? localInputToInstant(deadline) : undefined });
  }

  return <form noValidate onSubmit={submit} className="space-y-4" aria-label={`Заявка: ${title}`}>
    <div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-stitch-muted">Цена {priceRub.toLocaleString('ru-RU')} ₽. Банк перейдёт целиком, без сдачи, только после закрытия сделки.</p></div>
    {!available.length ? <Notice tone="warn">Нет активного банка с достаточным номиналом. Номинал продолжает уменьшаться ежедневно, в том числе во время сделки.</Notice> : null}
    <Field label="Банк на обмен" hint="Показываем только активные банки, которые покрывают цену."><select required value={bankId} onChange={(event) => setBankId(event.target.value)} className={inputClass}><option value="">Выберите банк</option>{available.map((right) => <option key={right.id} value={right.id}>до {right.nominalRub} ₽ · переходов {right.hopsLeft}</option>)}</select></Field>
    {selectedRight?.nominalRub != null ? settingsReady ? <div className="grid gap-2 rounded-xl bg-stitch-canvas/60 p-4 text-sm sm:grid-cols-2"><p>Сегодня банк: до {selectedRight.nominalRub.toLocaleString('ru-RU')} ₽</p><p>Завтра: до {nominalTomorrow?.toLocaleString('ru-RU')} ₽</p>{feeSourceLabel ? <p className="text-stitch-muted sm:col-span-2">Комиссия 1 заслуга: {feeSourceLabel}.</p> : null}</div> : <p className="rounded-xl bg-stitch-canvas/60 p-4 text-sm text-stitch-muted">Загружаем условия…</p> : null}
    <Field label="Сообщение исполнителю" hint="Напишите, что нужно и какие детали важно учесть."><textarea required minLength={1} maxLength={1000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} placeholder="Например: нужна консультация по договору, удобно вечером…" /></Field>
    <Field label="Желаемый срок (необязательно)" hint="Исполнитель подтвердит или предложит свой срок при принятии.">
      <input type="datetime-local" min={minimumLocalDeadline()} value={deadline} onChange={(event) => { setDeadline(event.target.value); setDeadlineError(null); }} className={inputClass} />
    </Field>
    {deadlineError ? <p role="alert" className="text-sm text-amber-200">{deadlineError}</p> : null}
    {serverError ? <Notice tone="warn">{serverError}</Notice> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button><Button type="submit" disabled={pending || !available.length || !bankId || !message.trim()}>{pending ? 'Отправляем…' : 'Подтвердить заявку'}</Button></div>
  </form>;
}
