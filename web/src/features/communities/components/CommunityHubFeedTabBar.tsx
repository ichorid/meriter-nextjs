'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  formatHubFeedTabCount,
  useCommunityHubFeedTabCounts,
} from '@/features/communities/hooks/useCommunityHubFeedTabCounts';
import type { CommunityHubFeedTab } from '@/features/communities/lib/community-hub-feed-tab';

export type { CommunityHubFeedTab };

const DEFAULT_VISIBLE: readonly CommunityHubFeedTab[] = [
  'posts',
  'projects',
  'events',
  'birzha',
];

const TAB_ORDER: readonly CommunityHubFeedTab[] = ['posts', 'projects', 'events', 'birzha'];

export function CommunityHubFeedTabBar({
  communityId,
  visibleTabs = DEFAULT_VISIBLE,
  hubKind = 'community',
  activeTab,
  onTabChange,
  className,
}: {
  communityId: string;
  /** Subset of hub tabs (e.g. project hub omits «Проекты сообщества»). */
  visibleTabs?: readonly CommunityHubFeedTab[];
  /** Project cooperative hub uses tickets/discussions for the posts tab. */
  hubKind?: 'community' | 'project';
  activeTab: CommunityHubFeedTab;
  onTabChange: (tab: CommunityHubFeedTab) => void;
  /** When tabs sit inside the feed chrome card (no outer border / separate rounding). */
  className?: string;
}) {
  const t = useTranslations('pages.communities');

  const orderedTabs = useMemo(
    () => TAB_ORDER.filter((id) => visibleTabs.includes(id)),
    [visibleTabs],
  );

  const { counts: tabCounts, isLoading: tabCountsLoading } = useCommunityHubFeedTabCounts(
    communityId,
    orderedTabs,
    { hubKind },
  );

  const labelFor = (id: CommunityHubFeedTab): string => {
    switch (id) {
      case 'posts':
        return t('feedTabPosts');
      case 'projects':
        return t('feedTabProjects');
      case 'events':
        return t('feedTabEvents');
      case 'birzha':
        return t('feedTabBirzha');
      default:
        return id;
    }
  };

  const n = orderedTabs.length;

  return (
    <div
      role="tablist"
      aria-label={t('feedTabListAria')}
      className={cn(
        'relative z-10 grid w-full shrink-0 gap-0.5 border border-base-content/15 bg-base-200/50 p-1 dark:border-stitch-border dark:bg-stitch-surface/40',
        className,
      )}
      style={{ gridTemplateColumns: n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined }}
    >
      {orderedTabs.map((tab) => {
        const selected = activeTab === tab;
        const label = labelFor(tab);
        const count = tabCounts[tab];
        const showCount = !tabCountsLoading && count !== undefined;
        const tabAriaLabel =
          showCount && count !== undefined
            ? `${label} (${count})`
            : label;

        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'page' : undefined}
            aria-label={tabAriaLabel}
            onClick={() => {
              if (!selected) onTabChange(tab);
            }}
            className={cn(
              'flex min-h-9 w-full items-center justify-center rounded-lg border px-1 py-1.5 text-center text-sm font-medium transition-colors sm:px-2',
              selected
                ? 'border-base-content/20 bg-base-100 text-base-content shadow-sm dark:border-stitch-border dark:bg-stitch-surface dark:text-stitch-text'
                : 'border-transparent text-base-content/70 hover:border-base-content/10 hover:bg-base-300/50 hover:text-base-content dark:text-stitch-muted dark:hover:border-stitch-border/60 dark:hover:bg-stitch-surface2/80 dark:hover:text-stitch-text',
            )}
          >
            <span className="flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1.5">
              <span className="line-clamp-2 min-w-0 leading-tight">{label}</span>
              {showCount ? (
                <span
                  aria-hidden
                  className={cn(
                    'shrink-0 rounded-md px-1 py-px text-[10px] font-semibold tabular-nums leading-none',
                    selected
                      ? 'bg-primary/15 text-primary dark:bg-primary/25'
                      : 'bg-base-content/8 text-base-content/45 dark:bg-base-content/12',
                  )}
                >
                  {formatHubFeedTabCount(count)}
                </span>
              ) : tabCountsLoading ? (
                <span
                  aria-hidden
                  className="h-3.5 w-5 shrink-0 animate-pulse rounded-md bg-base-content/10"
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
