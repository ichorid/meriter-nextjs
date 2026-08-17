'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Field, Notice, NumberField } from '@/components/ui';
import { INTEGER_RUBLES_MESSAGE } from '@/lib/utils';

export type NominalAssignSettings = {
  autoAssignNominal: boolean;
  defaultNominalRub: number;
  nominalFloorRub: number;
};

export function AdminNominalSettings({
  settings,
  pending,
  error,
  onSave,
}: {
  settings?: Partial<NominalAssignSettings>;
  pending: boolean;
  error?: string | null;
  onSave: (patch: Pick<NominalAssignSettings, 'autoAssignNominal' | 'defaultNominalRub'>) => void;
}) {
  const floor = settings?.nominalFloorRub ?? 100;
  const [autoAssign, setAutoAssign] = useState(settings?.autoAssignNominal === true);
  const [defaultNominal, setDefaultNominal] = useState(String(settings?.defaultNominalRub ?? floor));
  const [confirmation, setConfirmation] = useState(false);
  const [integerError, setIntegerError] = useState<string | null>(null);

  useEffect(() => {
    setAutoAssign(settings?.autoAssignNominal === true);
    setDefaultNominal(String(settings?.defaultNominalRub ?? settings?.nominalFloorRub ?? 100));
    setConfirmation(false);
    setIntegerError(null);
  }, [settings?.autoAssignNominal, settings?.defaultNominalRub, settings?.nominalFloorRub]);

  function parsedNominal() {
    const value = Number(defaultNominal);
    return Number.isSafeInteger(value) ? value : null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nominal = parsedNominal();
    if (nominal == null) {
      setIntegerError(INTEGER_RUBLES_MESSAGE);
      return;
    }
    setIntegerError(null);
    if (autoAssign && !settings?.autoAssignNominal) {
      setConfirmation(true);
      return;
    }
    onSave({ autoAssignNominal: autoAssign, defaultNominalRub: nominal });
  }

  return (
    <Card>
      <form noValidate onSubmit={submit} className="space-y-4">
        <div>
          <h3 className="font-extrabold">Автоназначение номинала</h3>
          <p className="mt-1 text-sm leading-6 text-stitch-muted">
            Если включено, новые банки сразу получают номинал по умолчанию и не ждут ручной очереди.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-stitch-border px-4 text-sm">
          <input
            type="checkbox"
            checked={autoAssign}
            onChange={(event) => {
              setConfirmation(false);
              setAutoAssign(event.target.checked);
            }}
          />
          Автоназначение номинала
        </label>
        <Field label="Номинал по умолчанию, ₽" hint={`Не ниже нижнего номинала (${floor} ₽).`}>
          <NumberField
            min={floor}
            max={1_000_000_000}
            step={1}
            required
            value={defaultNominal}
            onChange={(event) => {
              setIntegerError(null);
              setDefaultNominal(event.target.value);
            }}
          />
        </Field>
        {integerError ? <p role="alert" className="text-sm text-amber-200">{integerError}</p> : null}
        {confirmation ? (
          <Notice tone="warn">
            <strong>Все банки в очереди сразу получат номинал по умолчанию.</strong> Новые банки тоже будут активироваться автоматически.
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || parsedNominal() == null}
                onClick={() => {
                  const nominal = parsedNominal();
                  if (nominal == null) return;
                  setConfirmation(false);
                  onSave({ autoAssignNominal: true, defaultNominalRub: nominal });
                }}
              >
                Включить автоназначение
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmation(false)}>
                Вернуться
              </Button>
            </div>
          </Notice>
        ) : null}
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <Button type="submit" disabled={pending || confirmation}>
          {pending ? 'Сохраняем…' : 'Сохранить назначение номинала'}
        </Button>
      </form>
    </Card>
  );
}
