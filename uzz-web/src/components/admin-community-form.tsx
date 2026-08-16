'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Field, Notice, inputClass } from '@/components/ui';

export interface AdminCommunityOption {
  id: string;
  name: string;
}

export function AdminCommunityForm({
  communities,
  selectedCommunityId,
  pending,
  error,
  onSave,
}: {
  communities: AdminCommunityOption[];
  selectedCommunityId: string;
  pending: boolean;
  error?: string | null;
  onSave: (communityId: string) => void;
}) {
  const [value, setValue] = useState(selectedCommunityId);
  useEffect(() => { setValue(selectedCommunityId); }, [selectedCommunityId]);
  const options = communities.some((entry) => entry.id === selectedCommunityId) || !selectedCommunityId
    ? communities
    : [{ id: selectedCommunityId, name: 'Текущее сообщество' }, ...communities];
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value) return;
    onSave(value);
  }
  return <Card>
    <form noValidate onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-black">Сообщество площадки</h2>
        <p className="mt-1 text-sm leading-6 text-stitch-muted">
          Услуги за заслуги работают в одном сообществе на стенд. Список — сообщества, в которых вы состоите.
          Смена действует для всех пользователей, включая гостей. Если в новом сообществе нет прав администратора, этот раздел станет недоступен.
        </p>
      </div>
      {options.length ? (
        <Field label="Сообщество" hint="Правила обмена ниже относятся к выбранному сообществу.">
          <select
            aria-label="Сообщество"
            className={inputClass}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            {options.map((community) => (
              <option key={community.id} value={community.id}>{community.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Notice tone="warn">Нет сообществ, в которых вы состоите. Сначала вступите в нужное сообщество.</Notice>
      )}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button type="submit" disabled={pending || !value || value === selectedCommunityId}>
        {pending ? 'Сохраняем…' : 'Сохранить сообщество'}
      </Button>
    </form>
  </Card>;
}
