'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import type { CommunityTab } from '@/lib/community-nav';
import { cn } from '@/lib/utils';

type CommunityMoreSheetProps = {
  open: boolean;
  onClose: () => void;
  tabs: CommunityTab[];
  activeId: string;
  moderationPendingCount?: number;
};

export function CommunityMoreSheet({
  open,
  onClose,
  tabs,
  activeId,
  moderationPendingCount = 0,
}: CommunityMoreSheetProps) {
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

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Закрыть меню"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Дополнительные разделы"
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-stitch-border bg-stitch-sidebar pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stitch-border" />
          <p className="mb-3 text-sm font-semibold text-stitch-text">Ещё</p>
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeId === tab.id;
              const showBadge =
                tab.id === 'moderation' && moderationPendingCount > 0;

              return (
                <li key={tab.id}>
                  <Link
                    href={tab.href}
                    onClick={onClose}
                    className={cn(
                      'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-stitch-text hover:bg-stitch-surface',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="flex-1">{tab.label}</span>
                    {showBadge && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
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
    </div>
  );
}

type CommunityMoreNavButtonProps = {
  active: boolean;
  onClick: () => void;
};

export function CommunityMoreNavButton({
  active,
  onClick,
}: CommunityMoreNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ещё"
      aria-expanded={active}
      className={cn(
        'flex min-h-[var(--shell-bottom-nav-height)] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors',
        active ? 'text-primary' : 'text-stitch-muted',
      )}
    >
      <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
      <span>Ещё</span>
    </button>
  );
}
