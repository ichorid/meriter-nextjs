'use client';

import { FormEvent, useState } from 'react';
import { Button, Card, Field, Notice, inputClass } from '@/components/ui';

export interface ListingDraft {
  title: string;
  description?: string;
  priceRub: number;
  deliveryMode: 'online' | 'offline' | 'both';
  locationText?: string;
  durationText?: string;
  availabilityText?: string;
}

interface FormState {
  title: string;
  description: string;
  priceRub: string;
  deliveryMode: ListingDraft['deliveryMode'];
  locationText: string;
  durationText: string;
  availabilityText: string;
}

export function ListingEditor({ initial, pending, error, submitLabel = 'Опубликовать', onCancel, onSubmit }: {
  initial?: ListingDraft;
  pending: boolean;
  error?: string | null;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (value: ListingDraft) => void;
}) {
  const [form, setForm] = useState<FormState>({
    title: initial?.title ?? '', description: initial?.description ?? '',
    priceRub: String(initial?.priceRub ?? 500), deliveryMode: initial?.deliveryMode ?? 'online',
    locationText: initial?.locationText ?? '', durationText: initial?.durationText ?? '',
    availabilityText: initial?.availabilityText ?? '',
  });
  const [errors, setErrors] = useState<{ title?: string; priceRub?: string }>({});
  const field = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const priceRub = Number(form.priceRub);
    const nextErrors = {
      title: form.title.trim().length < 3 ? 'Название должно содержать не меньше 3 символов' : undefined,
      priceRub: !Number.isSafeInteger(priceRub) || priceRub <= 0 ? 'Цена должна быть целым числом больше нуля' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.priceRub) return;
    onSubmit({
      title: form.title.trim(), description: form.description.trim() || undefined, priceRub,
      deliveryMode: form.deliveryMode, locationText: form.locationText.trim() || undefined,
      durationText: form.durationText.trim() || undefined,
      availabilityText: form.availabilityText.trim() || undefined,
    });
  }

  return <Card><form className="space-y-4" noValidate onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Название"><input maxLength={120} className={inputClass} value={form.title} aria-invalid={Boolean(errors.title)} onChange={(event) => field('title', event.target.value)} />{errors.title ? <span role="alert" className="block text-xs text-amber-200">{errors.title}</span> : null}</Field>
    <Field label="Цена, ₽"><input type="number" min={1} step={1} inputMode="numeric" className={inputClass} value={form.priceRub} aria-invalid={Boolean(errors.priceRub)} onChange={(event) => field('priceRub', event.target.value)} />{errors.priceRub ? <span role="alert" className="block text-xs text-amber-200">{errors.priceRub}</span> : null}</Field>
    <Field label="Формат"><select className={inputClass} value={form.deliveryMode} onChange={(event) => setForm((current) => ({ ...current, deliveryMode: event.target.value as FormState['deliveryMode'] }))}><option value="online">Онлайн</option><option value="offline">Очно</option><option value="both">Онлайн или очно</option></select></Field>
    <Field label="Длительность" hint="Свободный текст: «60 минут», «2 встречи по часу»."><input maxLength={120} className={inputClass} value={form.durationText} onChange={(event) => field('durationText', event.target.value)} placeholder="Например, 60 минут" /></Field>
    <Field label="Место" hint="Для онлайн-услуг можно оставить пустым."><input maxLength={160} className={inputClass} value={form.locationText} onChange={(event) => field('locationText', event.target.value)} /></Field>
    <Field label="Доступность" hint="Когда вам удобно оказывать услугу."><input maxLength={500} className={inputClass} value={form.availabilityText} onChange={(event) => field('availabilityText', event.target.value)} placeholder="Вечерами по будням" /></Field>
  </div><Field label="Описание"><textarea rows={4} maxLength={2000} className={inputClass} value={form.description} onChange={(event) => field('description', event.target.value)} /></Field>{error ? <Notice tone="warn" role="alert">{error}</Notice> : null}<div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : submitLabel}</Button>{onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button> : null}</div></form></Card>;
}
