'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';

interface RightOption { id: string; nominalRub: number | null; status: string; hopsLeft: number; }

export function DealRequestForm({ title, priceRub, rights, pending, error, onCancel, onSubmit }: { title: string; priceRub: number; rights: RightOption[]; pending: boolean; error?: string | null; onCancel: () => void; onSubmit: (data: { bankId: string; requestMessage: string; requestedDeadlineAt?: Date }) => void }) {
  const available = useMemo(() => rights.filter((right) => right.status === 'active' && (right.nominalRub ?? 0) >= priceRub), [priceRub, rights]);
  const [bankId, setBankId] = useState(available[0]?.id ?? ''); const [message, setMessage] = useState(''); const [deadline, setDeadline] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!bankId || !message.trim()) return; onSubmit({ bankId, requestMessage: message.trim(), requestedDeadlineAt: deadline ? new Date(deadline) : undefined }); }
  return <form onSubmit={submit} className="space-y-4" aria-label={`Заявка: ${title}`}>
    <div><h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-stitch-muted">Цена {priceRub.toLocaleString('ru-RU')} ₽. Право перейдёт целиком, без сдачи, только после закрытия сделки.</p></div>
    {!available.length ? <Notice tone="warn">Нет активного права с достаточным номиналом. Номинал продолжает уменьшаться ежедневно, в том числе во время сделки.</Notice> : null}
    <Field label="Право на обмен" hint="Показываем только активные права, которые покрывают цену."><select required value={bankId} onChange={(event) => setBankId(event.target.value)} className={inputClass}><option value="">Выберите право</option>{available.map((right) => <option key={right.id} value={right.id}>до {right.nominalRub} ₽ · переходов {right.hopsLeft}</option>)}</select></Field>
    <Field label="Сообщение исполнителю" hint="Напишите, что нужно и какие детали важно учесть."><textarea required minLength={1} maxLength={1000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} placeholder="Например: нужна консультация по договору, удобно вечером…" /></Field>
    <Field label="Желаемый срок (необязательно)" hint="Исполнитель подтвердит или предложит свой срок при принятии."><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass} /></Field>
    {error ? <Notice tone="warn">{error}</Notice> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button><Button type="submit" disabled={pending || !available.length || !bankId || !message.trim()}>{pending ? 'Отправляем…' : 'Подтвердить заявку'}</Button></div>
  </form>;
}
