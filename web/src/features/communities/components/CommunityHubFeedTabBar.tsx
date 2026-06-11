'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  formatHubFeedTabCount,
  useCommunityHubFeedTabCounts,
} from '@/features/communities/hooks/useCommunityHubFeedTabCounts';
import {
  buildCommunityHubFeedTabHref,
  needsCommunityHubFeedTabSanitize,
  resolveCommunityHubFeedTab,
  type CommunityHubFeedTab,
} from '@/features/communities/lib/community-hub-feed-tab';

const SCROLL_OPTS = { scroll: false as const };

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
  className,
}: {
  communityId: string;
  /** Subset of hub tabs (e.g. project hub omits «Проекты сообщества»). */
  visibleTabs?: readonly CommunityHubFeedTab[];
  /** Project cooperative hub uses tickets/discussions for the posts tab. */
  hubKind?: 'community' | 'project';
  /** When tabs sit inside the feed chrome card (no outer border / separate rounding). */
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');

  const orderedTabs = useMemo(
    () => TAB_ORDER.filter((id) => visibleTabs.includes(id)),
    [visibleTabs],
  );
  const visibleTabsKey = useMemo(() => orderedTabs.join(','), [orderedTabs]);

  const { counts: tabCounts, isLoading: tabCountsLoading } = useCommunityHubFeedTabCounts(
    communityId,
    orderedTabs,
    { hubKind },
  );

  const feedTabRaw = searchParams?.get('feedTab') ?? null;
  const searchParamsString = searchParams?.toString() ?? '';
  const active = resolveCommunityHubFeedTab(feedTabRaw, orderedTabs);
  const shouldSanitizeUrl = needsCommunityHubFeedTabSanitize(feedTabRaw, orderedTabs);

  useEffect(() => {
    if (!pathname || !shouldSanitizeUrl) return;
    const href = buildCommunityHubFeedTabHref(
      pathname,
      searchParamsString,
      resolveCommunityHubFeedTab(feedTabRaw, orderedTabs),
    );
    router.replace(href, SCROLL_OPTS);
  }, [
    feedTabRaw,
    orderedTabs,
    pathname,
    router,
    searchParamsString,
    shouldSanitizeUrl,
    visibleTabsKey,
  ]);

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
  const basePath = pathname ?? '';

  return (
    <div
      role="tablist"
      aria-label={t('feedTabListAria')}
      className={cn(
        'relative z-10 grid w-full shrink-0 gap-0.5 bg-base-200/35 p-1 dark:bg-base-200/25',
        className,
      )}
      style={{ gridTemplateColumns: n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined }}
    >
      {orderedTabs.map((tab) => {
        const selected = active === tab;
        const label = labelFor(tab);
        const count = tabCounts[tab];
        const showCount = !tabCountsLoading && count !== undefined;
        const tabAriaLabel =
          showCount && count !== undefined
            ? `${label} (${count})`
            : label;
        const href = buildCommunityHubFeedTabHref(basePath, searchParamsString, tab);

        return (
          <Link
            key={tab}
            href={href}
            replace
            scroll={false}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'page' : undefined}
            aria-label={tabAriaLabel}
            className={cn(
              'flex min-h-9 w-full items-center justify-center rounded-lg px-1 py-1.5 text-center text-sm font-medium transition-colors sm:px-2',
              selected
                ? 'bg-base-100 text-base-content shadow-sm dark:bg-base-300/80'
                : 'text-base-content/70 hover:bg-base-300/40 hover:text-base-content',
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
          </Link>
        );
      })}
    </div>
  );
}
