'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { TgCommunityTab } from '@/lib/community-nav-tg';

type CommunityBottomNavTgProps = {
  tabs: TgCommunityTab[];
  activeId: string;
};

export function CommunityBottomNavTg({ tabs, activeId }: CommunityBottomNavTgProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stitch-border bg-stitch-sidebar pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-3xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeId === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'flex min-h-[var(--shell-bottom-nav-height)] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors',
                isActive ? 'text-primary' : 'text-stitch-muted',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>{tab.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
