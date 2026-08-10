'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  getMoreTabs,
  getPrimaryTabs,
  isMoreTabActive,
  type CommunityTab,
} from '@/lib/community-nav';
import { cn } from '@/lib/utils';
import {
  CommunityMoreNavButton,
  CommunityMoreSheet,
} from '@/components/community-more-sheet';

type CommunityBottomNavProps = {
  tabs: CommunityTab[];
  activeId: string;
  moderationPendingCount?: number;
};

export function CommunityBottomNav({
  tabs,
  activeId,
  moderationPendingCount = 0,
}: CommunityBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryTabs = getPrimaryTabs(tabs);
  const moreTabs = getMoreTabs(tabs);
  const moreActive = isMoreTabActive(activeId);

  return (
    <>
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stitch-border bg-stitch-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-3xl">
          {primaryTabs.map((tab) => {
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
          <CommunityMoreNavButton
            active={moreActive || moreOpen}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <CommunityMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        tabs={moreTabs}
        activeId={activeId}
        moderationPendingCount={moderationPendingCount}
      />
    </>
  );
}
