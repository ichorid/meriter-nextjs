'use client';

import { X } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

const STEPS: Array<[string, string]> = [
  ['Доброе дело', 'Расскажите о нём в Telegram-чате сообщества — участники начислят вам заслуги.'],
  ['Банк на обмен', 'Один пост, набравший порог заслуг, превращается в банк — сумму, в пределах которой можно заказать услугу.'],
  ['Обмен', 'Выберите услугу и оставьте заявку. Комиссия — 1 заслуга, банк уходит исполнителю целиком после закрытия сделки.'],
];

export function OnboardingStrip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="relative">
      <button
        type="button"
        aria-label="Скрыть подсказку"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-stitch-muted transition hover:text-stitch-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <p className="text-xs font-bold uppercase tracking-widest text-stitch-accent-text">Как это работает</p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([title, copy], index) => (
          <li key={title} className="min-w-0 text-sm">
            <Badge tone="accent">Шаг {index + 1}</Badge>
            <p className="mt-1.5 font-bold">{title}</p>
            <p className="mt-0.5 leading-5 text-stitch-muted">{copy}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
