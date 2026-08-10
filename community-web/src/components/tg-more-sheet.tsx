'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { TgMoreTab } from '@/lib/community-nav-tg';

type TgMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  tabs: TgMoreTab[];
  moderationPendingCount?: number;
};

export function TgMoreSheet({
  open,
  onClose,
  tabs,
  moderationPendingCount = 0,
}: TgMoreSheetProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Дополнительные разделы"
        className="relative rounded-t-2xl border-t border-stitch-border bg-stitch-sidebar px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stitch-border" />
        <p className="mb-3 text-sm font-semibold text-stitch-text">Ещё</p>
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <li key={tab.id}>
                <Link
                  href={tab.href}
                  onClick={onClose}
                  className={cn(
                    'flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-stitch-text hover:bg-stitch-surface',
                  )}
                >
                  {tab.label}
                  {tab.id === 'moderation' && moderationPendingCount > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      {moderationPendingCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
