'use client';

import { useState } from 'react';
import { Button, Card, Notice } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { formatWhen, uzzErrorMessage } from '@/lib/utils';

export function AdminBackfillCard({
  communityId,
  alreadyRanAt,
  emittedCount,
  onDone,
  onError,
}: {
  communityId: string;
  alreadyRanAt?: Date | string | null;
  emittedCount?: number | null;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const preview = trpc.settings.previewBackfill.useQuery(
    { communityId },
    { enabled: Boolean(communityId) && !alreadyRanAt, retry: false },
  );
  const run = trpc.settings.backfillRights.useMutation({
    onSuccess: (result) => {
      setConfirm(false);
      onDone(
        `Выдано банков: ${result.emitted}. Уведомлено участников: ${result.ownersNotified}.`,
      );
    },
    onError: (error) => onError(uzzErrorMessage(error)),
  });
  const [confirm, setConfirm] = useState(false);
  const ranAt = alreadyRanAt ?? preview.data?.alreadyRanAt ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black">Опасные действия</h2>
        <p className="text-sm text-stitch-muted">Разовые операции запуска. Их нельзя отменить.</p>
      </div>
      <Card>
        {ranAt ? (
          <>
            <h3 className="font-extrabold">Банки за прошлые дела уже выданы</h3>
            <p className="mt-2 text-sm text-stitch-muted">
              Прогон {formatWhen(ranAt)}
              {emittedCount != null ? ` · выдано ${emittedCount}` : ''}.
            </p>
          </>
        ) : (
          <>
            <h3 className="font-extrabold">Выдать банки за прошлые дела</h3>
            <p className="mt-2 text-sm leading-6 text-stitch-muted">
              Пройти историю добрых дел, которые уже набрали текущий порог заслуг,
              и выдать банки тем, у кого их ещё нет. В личку уйдёт одно сообщение
              на человека, в групповой чат — ничего.
            </p>
            {preview.isError ? (
              <Notice tone="warn">Не удалось посчитать превью. Обновите страницу.</Notice>
            ) : preview.data ? (
              <p className="mt-3 text-sm">
                Будет выдано <strong>{preview.data.wouldEmit}</strong> банков{' '}
                <strong>{preview.data.owners}</strong> участникам. Порог:{' '}
                {preview.data.emissionThreshold} заслуг. Автономинал:{' '}
                {preview.data.autoAssignNominal
                  ? `вкл, ${preview.data.defaultNominalRub.toLocaleString('ru-RU')} ₽`
                  : 'выкл, назначит администратор'}
                . Уже есть банк: {preview.data.alreadyHaveBank}.
                {preview.data.truncated ? ' Показаны первые 500 дел.' : ''}
              </p>
            ) : (
              <p className="mt-3 text-sm text-stitch-muted">Считаем превью…</p>
            )}
            {confirm ? (
              <Notice tone="warn">
                <strong>Аккуратно: действие разовое.</strong> Используются текущие
                настройки порога и номинала. Повторно кнопка не сработает.
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={run.isPending || !preview.data}
                    onClick={() => run.mutate({ communityId })}
                  >
                    {run.isPending ? 'Выдаём…' : 'Выдать банки'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
                    Отмена
                  </Button>
                </div>
              </Notice>
            ) : (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="danger"
                  disabled={!preview.data || preview.data.wouldEmit === 0}
                  onClick={() => setConfirm(true)}
                >
                  Выдать банки за прошлые дела
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
