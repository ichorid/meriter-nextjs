'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Field, Notice, NumberField, inputClass } from '@/components/ui';

export interface AdminSettings { emissionThreshold: number; initialHops: number; demurrageRubPerDay: number; nominalFloorRub: number; minimumListingsToBuy: number; purchaseGateMode: 'nudge' | 'require_min_lots'; requestTtlHours: number; fulfillmentTtlDays: number; confirmationTtlDays: number; }

export function AdminSettingsForm({ settings, pending, error, onSave }: { settings?: AdminSettings; pending: boolean; error?: string | null; onSave: (patch: AdminSettings) => void }) {
  const [form, setForm] = useState<AdminSettings>({ emissionThreshold: 10, initialHops: 10, demurrageRubPerDay: 100, nominalFloorRub: 100, minimumListingsToBuy: 3, purchaseGateMode: 'nudge', requestTtlHours: 48, fulfillmentTtlDays: 7, confirmationTtlDays: 7 });
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  const number = (key: Exclude<keyof AdminSettings, 'purchaseGateMode'>, value: string) => setForm((current) => ({ ...current, [key]: Number(value) }));
  function submit(event: FormEvent) { event.preventDefault(); onSave(form); }
  return <Card><form onSubmit={submit} className="space-y-5"><div><h2 className="text-xl font-black">Правила пилота</h2><p className="mt-1 text-sm leading-6 text-stitch-muted">Изменения действуют для новых событий. Уже созданные сделки сохраняют собственные сроки.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="Порог заслуг" hint="После этого результата появляется право."><NumberField min={1} required value={form.emissionThreshold} onChange={(event) => number('emissionThreshold', event.target.value)} /></Field>
    <Field label="Переходов права" hint="На нижнем номинале право не сгорает."><NumberField min={1} required value={form.initialHops} onChange={(event) => number('initialHops', event.target.value)} /></Field>
    <Field label="Таяние, ₽ в день" hint="Работает и во время сделки."><NumberField min={0} required value={form.demurrageRubPerDay} onChange={(event) => number('demurrageRubPerDay', event.target.value)} /></Field>
    <Field label="Нижний номинал, ₽"><NumberField min={1} required value={form.nominalFloorRub} onChange={(event) => number('nominalFloorRub', event.target.value)} /></Field>
    <Field label="Рекомендовано карточек"><NumberField min={0} required value={form.minimumListingsToBuy} onChange={(event) => number('minimumListingsToBuy', event.target.value)} /></Field>
    <Field label="Режим взаимности"><select className={inputClass} value={form.purchaseGateMode} onChange={(event) => setForm((current) => ({ ...current, purchaseGateMode: event.target.value as AdminSettings['purchaseGateMode'] }))}><option value="nudge">Мягкая рекомендация</option><option value="require_min_lots">Обязательный минимум</option></select></Field>
    <Field label="Ответ на заявку, часов"><NumberField min={1} required value={form.requestTtlHours} onChange={(event) => number('requestTtlHours', event.target.value)} /></Field>
    <Field label="Исполнение, дней"><NumberField min={1} required value={form.fulfillmentTtlDays} onChange={(event) => number('fulfillmentTtlDays', event.target.value)} /></Field>
    <Field label="Подтверждение, дней"><NumberField min={1} required value={form.confirmationTtlDays} onChange={(event) => number('confirmationTtlDays', event.target.value)} /></Field>
  </div>{error ? <Notice tone="warn">{error}</Notice> : null}<Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить настройки'}</Button></form></Card>;
}
