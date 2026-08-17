'use client';

import { Card, Notice } from '@/components/ui';

export type HoldingBank = {
  id: string;
  ownerName: string;
  sourceTitle?: string | null;
  sourceScore?: number | null;
};

export function HoldingBanksNotice({ banks }: { banks: HoldingBank[] }) {
  if (!banks.length) return null;
  return (
    <section className="space-y-4">
      <Notice tone="info">
        <strong>Ждут привязку профиля: {banks.length}.</strong> Эти банки автоматически
        перейдут в очередь номиналов после связывания email и Telegram.
      </Notice>
      <ul className="grid gap-3 md:grid-cols-2">
        {banks.map((right) => (
          <li key={right.id}>
            <Card>
              <h3 className="font-extrabold">{right.ownerName}</h3>
              <p className="mt-1 text-sm text-stitch-muted">
                {right.sourceTitle || 'Доброе дело'} · {right.sourceScore ?? 0} заслуг
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
