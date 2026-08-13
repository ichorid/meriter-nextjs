'use client';
import { FormEvent, useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';

export function DealAcceptForm({ currentNominalRub, requestedDeadlineAt, pending, error, onCancel, onAccept }: { currentNominalRub: number | null; requestedDeadlineAt?: Date | string | null; pending: boolean; error?: string | null; onCancel: () => void; onAccept: (deadline?: Date) => void }) {
  const initial = requestedDeadlineAt ? new Date(requestedDeadlineAt).toISOString().slice(0, 16) : ''; const [deadline, setDeadline] = useState(initial);
  function submit(event: FormEvent) { event.preventDefault(); onAccept(deadline ? new Date(deadline) : undefined); }
  return <form onSubmit={submit} className="space-y-4"><Notice tone="warn"><strong>Проверьте номинал: {currentNominalRub?.toLocaleString('ru-RU') ?? '—'} ₽.</strong> Он тает каждый день, даже пока заявка открыта. Принятие фиксирует именно показанную сумму; если она успела измениться, система попросит подтвердить ещё раз.</Notice><Field label="Согласованный срок" hint="Можно оставить пожелание заказчика или указать другой срок."><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={inputClass} /></Field>{error ? <Notice tone="warn">{error}</Notice> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onCancel}>Назад</Button><Button type="submit" disabled={pending || currentNominalRub == null}>{pending ? 'Проверяем…' : `Принять на ${currentNominalRub ?? '—'} ₽`}</Button></div></form>;
}
