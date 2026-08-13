'use client';

import { FormEvent, useState } from 'react';
import { Button, Notice, inputClass } from '@/components/ui';

export function ThanksForm({ pending, error, onCancel, onSubmit }: { pending: boolean; error?: string | null; onCancel: () => void; onSubmit: (value: { comment?: string; merits?: number }) => void }) {
  const [comment, setComment] = useState('');
  const [merits, setMerits] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(merits);
    if (merits !== '' && (!Number.isSafeInteger(amount) || amount <= 0)) {
      setAmountError('Количество заслуг должно быть целым числом больше нуля.');
      return;
    }
    setAmountError(null);
    onSubmit({ comment: comment.trim() || undefined, merits: merits === '' ? undefined : amount });
  }

  return <form className="space-y-3" noValidate onSubmit={submit}>
    <h3 className="font-extrabold">Необязательная благодарность</h3>
    <p className="text-sm text-stitch-muted">Если добавите заслуги, вся сумма спишется сначала из кошелька сообщества, а если там не хватит — из общего. Балансы не складываются.</p>
    <textarea className={inputClass} rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="За что хотите поблагодарить" />
    <input className={inputClass} type="number" min={1} max={10000} step={1} value={merits} aria-invalid={Boolean(amountError)} onChange={(event) => { setMerits(event.target.value); setAmountError(null); }} placeholder="Заслуг, если хотите добавить" />
    {amountError ? <p role="alert" className="text-sm text-amber-200">{amountError}</p> : null}
    {error ? <Notice tone="warn">{error}</Notice> : null}
    <div className="flex gap-2"><Button type="submit" disabled={pending || (!comment.trim() && !(Number(merits) > 0))}>Отправить</Button><Button type="button" variant="ghost" onClick={onCancel}>Пропустить</Button></div>
  </form>;
}
