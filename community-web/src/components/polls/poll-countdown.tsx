'use client';

import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Завершено';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Осталось ${days} дн ${hours} ч`;
  if (hours > 0) return `Осталось ${hours} ч ${minutes} мин`;
  if (minutes > 0) return `Осталось ${minutes} мин`;
  return `Осталось ${Math.max(1, Math.floor(ms / 1000))} с`;
}

export function PollCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(expiresAt).getTime() - now;

  return (
    <span className={remaining > 0 ? 'text-primary' : 'text-stitch-muted'}>
      {formatRemaining(remaining)}
    </span>
  );
}
