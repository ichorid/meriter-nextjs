'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Field, Notice, NumberField, inputClass } from '@/components/ui';
import { INTEGER_RUBLES_MESSAGE } from '@/lib/utils';

export interface AdminSettings { emissionThreshold: number; initialHops: number; demurrageRubPerDay: number; nominalFloorRub: number; minimumListingsToBuy: number; purchaseGateMode: 'nudge' | 'require_min_lots'; requestTtlHours: number; fulfillmentTtlDays: number; confirmationTtlDays: number; notifyRightEmitted: boolean; notifyRequestLifecycle: boolean; notifyDealProgress: boolean; notifyDealClosed: boolean; }

type NumericSetting = Exclude<keyof AdminSettings, 'purchaseGateMode' | 'notifyRightEmitted' | 'notifyRequestLifecycle' | 'notifyDealProgress' | 'notifyDealClosed'>;

export function AdminSettingsForm({ settings, pending, error, onSave }: { settings?: AdminSettings; pending: boolean; error?: string | null; onSave: (patch: AdminSettings) => void }) {
  const [form, setForm] = useState<AdminSettings>({ emissionThreshold: 10, initialHops: 10, demurrageRubPerDay: 100, nominalFloorRub: 100, minimumListingsToBuy: 3, purchaseGateMode: 'nudge', requestTtlHours: 48, fulfillmentTtlDays: 7, confirmationTtlDays: 7, notifyRightEmitted: true, notifyRequestLifecycle: true, notifyDealProgress: true, notifyDealClosed: true });
  const [confirmation, setConfirmation] = useState<AdminSettings | null>(null);
  const [integerError, setIntegerError] = useState<string | null>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  const number = (key: NumericSetting, value: string) => { setIntegerError(null); setForm((current) => ({ ...current, [key]: Number(value) })); };
  const toggle = (key: 'notifyRightEmitted' | 'notifyRequestLifecycle' | 'notifyDealProgress' | 'notifyDealClosed', value: boolean) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    const numericValues = [form.emissionThreshold, form.initialHops, form.demurrageRubPerDay, form.nominalFloorRub, form.minimumListingsToBuy, form.requestTtlHours, form.fulfillmentTtlDays, form.confirmationTtlDays];
    if (!numericValues.every((value) => Number.isSafeInteger(value))) {
      setIntegerError(INTEGER_RUBLES_MESSAGE);
      return;
    }
    setIntegerError(null);
    const dangerousChange = settings && (
      settings.nominalFloorRub !== form.nominalFloorRub ||
      settings.requestTtlHours !== form.requestTtlHours ||
      settings.fulfillmentTtlDays !== form.fulfillmentTtlDays ||
      settings.confirmationTtlDays !== form.confirmationTtlDays
    );
    if (dangerousChange) { setConfirmation(form); return; }
    onSave(form);
  }
  return <Card><form noValidate onSubmit={submit} className="space-y-5"><div><h2 className="text-xl font-black">Правила пилота</h2><p className="mt-1 text-sm leading-6 text-stitch-muted">Изменения действуют для новых событий. Уже созданные сделки сохраняют собственные сроки.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="Порог заслуг" hint="После этого результата появляется банк на обмен."><NumberField min={1} max={1_000_000} step={1} required value={form.emissionThreshold} onChange={(event) => number('emissionThreshold', event.target.value)} /></Field>
    <Field label="Переходов банка" hint="На нижнем номинале банк не сгорает."><NumberField min={1} max={1_000} step={1} required value={form.initialHops} onChange={(event) => number('initialHops', event.target.value)} /></Field>
    <Field label="Таяние, ₽ в день" hint="Работает и во время сделки."><NumberField min={0} max={1_000_000} step={1} required value={form.demurrageRubPerDay} onChange={(event) => number('demurrageRubPerDay', event.target.value)} /></Field>
    <Field label="Нижний номинал, ₽" hint="Если номинал по умолчанию окажется ниже, он поднимется до этого значения."><NumberField min={1} max={1_000_000_000} step={1} required value={form.nominalFloorRub} onChange={(event) => number('nominalFloorRub', event.target.value)} /></Field>
    <Field label="Рекомендовано карточек"><NumberField min={0} max={100} step={1} required value={form.minimumListingsToBuy} onChange={(event) => number('minimumListingsToBuy', event.target.value)} /></Field>
    <Field label="Режим взаимности"><select className={inputClass} value={form.purchaseGateMode} onChange={(event) => setForm((current) => ({ ...current, purchaseGateMode: event.target.value as AdminSettings['purchaseGateMode'] }))}><option value="nudge">Мягкая рекомендация</option><option value="require_min_lots">Обязательный минимум</option></select></Field>
    <Field label="Ответ на заявку, часов"><NumberField min={1} max={8_760} step={1} required value={form.requestTtlHours} onChange={(event) => number('requestTtlHours', event.target.value)} /></Field>
    <Field label="Исполнение, дней"><NumberField min={1} max={3_650} step={1} required value={form.fulfillmentTtlDays} onChange={(event) => number('fulfillmentTtlDays', event.target.value)} /></Field>
    <Field label="Подтверждение, дней"><NumberField min={1} max={3_650} step={1} required value={form.confirmationTtlDays} onChange={(event) => number('confirmationTtlDays', event.target.value)} /></Field>
  </div><fieldset className="space-y-3"><legend className="font-extrabold">Telegram-уведомления</legend><p className="text-sm text-stitch-muted">Отключение влияет только на новые события. Ежедневных уведомлений о таянии нет.</p><div className="grid gap-3 sm:grid-cols-2">{([
    ['notifyRightEmitted', 'Появился банк на обмен'],
    ['notifyRequestLifecycle', 'Новая заявка или отмена'],
    ['notifyDealProgress', 'Заявка принята или услуга сделана'],
    ['notifyDealClosed', 'Сделка закрыта'],
  ] as const).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-stitch-border px-4 text-sm"><input type="checkbox" checked={form[key]} onChange={(event) => toggle(key, event.target.checked)} />{label}</label>)}</div></fieldset>{integerError ? <p role="alert" className="text-sm text-amber-200">{integerError}</p> : null}{confirmation ? <Notice tone="warn"><strong>Изменение нижнего номинала или сроков влияет на новые события.</strong> Уже созданные сделки сохранят зафиксированные сроки, а номинал никогда не увеличится автоматически.<div className="mt-3 flex flex-wrap gap-2"><Button type="button" disabled={pending} onClick={() => { const value = confirmation; setConfirmation(null); onSave(value); }}>Применить изменения</Button><Button type="button" variant="ghost" onClick={() => setConfirmation(null)}>Вернуться</Button></div></Notice> : null}{error ? <Notice tone="warn">{error}</Notice> : null}<Button type="submit" disabled={pending || Boolean(confirmation)}>{pending ? 'Сохраняем…' : 'Сохранить настройки'}</Button></form></Card>;
}
