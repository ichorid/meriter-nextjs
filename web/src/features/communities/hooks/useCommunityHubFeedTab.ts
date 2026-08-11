'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  buildCommunityHubFeedTabHref,
  needsCommunityHubFeedTabSanitize,
  resolveCommunityHubFeedTab,
  type CommunityHubFeedTab,
} from '@/features/communities/lib/community-hub-feed-tab';

const SCROLL_OPTS = { scroll: false as const };
/** Coalesce rapid tab clicks into one App Router soft-nav. */
const URL_REPLACE_DEBOUNCE_MS = 120;

export type UseCommunityHubFeedTabOptions = {
  /**
   * When false, skip URL sanitize/replace for unknown/hidden tabs.
   * Use while hub visibility is still loading so deep links like `?feedTab=birzha` are not stripped.
   */
  enableSanitize?: boolean;
};

/**
 * Optimistic hub feed tab: UI switches immediately; URL updates in a debounced transition.
 * Keeps shareable `?feedTab=` without blocking the click path on App Router soft nav.
 */
export function useCommunityHubFeedTab(
  visibleTabs: readonly CommunityHubFeedTab[],
  options?: UseCommunityHubFeedTabOptions,
) {
  const enableSanitize = options?.enableSanitize !== false;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedTabRaw = searchParams?.get('feedTab') ?? null;
  const searchParamsString = searchParams?.toString() ?? '';
  const visibleTabsKey = useMemo(() => visibleTabs.join(','), [visibleTabs]);

  const urlTab = useMemo(
    () => resolveCommunityHubFeedTab(feedTabRaw, visibleTabs),
    [feedTabRaw, visibleTabs, visibleTabsKey],
  );

  const [activeTab, setActiveTabState] = useState<CommunityHubFeedTab>(urlTab);
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<CommunityHubFeedTab>>(
    () => new Set<CommunityHubFeedTab>([urlTab]),
  );

  const lastUrlTabRef = useRef(urlTab);
  /** Latest tab the user selected; URL soft-nav may lag behind. */
  const pendingLocalTabRef = useRef<CommunityHubFeedTab | null>(null);
  const pathnameRef = useRef(pathname);
  const searchParamsStringRef = useRef(searchParamsString);
  const replaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  pathnameRef.current = pathname;
  searchParamsStringRef.current = searchParamsString;

  useEffect(() => {
    if (urlTab === lastUrlTabRef.current) return;
    lastUrlTabRef.current = urlTab;

    // While a local click is ahead of the URL, ignore intermediate/stale URL arrivals
    // (rapid clicks: events → birzha must not snap back when `?feedTab=events` lands first).
    if (pendingLocalTabRef.current != null) {
      if (pendingLocalTabRef.current === urlTab) {
        pendingLocalTabRef.current = null;
      }
      return;
    }

    setActiveTabState(urlTab);
    setVisitedTabs((prev) => {
      if (prev.has(urlTab)) return prev;
      const next = new Set(prev);
      next.add(urlTab);
      return next;
    });
  }, [urlTab]);

  useEffect(() => {
    if (!enableSanitize || !pathname) return;
    if (!needsCommunityHubFeedTabSanitize(feedTabRaw, visibleTabs)) return;
    const href = buildCommunityHubFeedTabHref(pathname, searchParamsString, urlTab);
    router.replace(href, SCROLL_OPTS);
  }, [
    enableSanitize,
    feedTabRaw,
    pathname,
    router,
    searchParamsString,
    urlTab,
    visibleTabs,
    visibleTabsKey,
  ]);

  useEffect(() => {
    return () => {
      if (replaceTimerRef.current != null) {
        clearTimeout(replaceTimerRef.current);
        replaceTimerRef.current = null;
      }
    };
  }, []);

  const flushUrlReplace = useCallback(() => {
    replaceTimerRef.current = null;
    const tab = pendingLocalTabRef.current;
    const basePath = pathnameRef.current;
    if (!tab || !basePath) return;
    const href = buildCommunityHubFeedTabHref(basePath, searchParamsStringRef.current, tab);
    startTransition(() => {
      router.replace(href, SCROLL_OPTS);
    });
  }, [router]);

  const setActiveTab = useCallback(
    (tab: CommunityHubFeedTab) => {
      if (!visibleTabs.includes(tab)) return;
      pendingLocalTabRef.current = tab;
      setActiveTabState(tab);
      setVisitedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
      if (replaceTimerRef.current != null) {
        clearTimeout(replaceTimerRef.current);
      }
      replaceTimerRef.current = setTimeout(flushUrlReplace, URL_REPLACE_DEBOUNCE_MS);
    },
    [flushUrlReplace, visibleTabs],
  );

  return {
    activeTab,
    setActiveTab,
    visitedTabs,
    isTabVisited: (tab: CommunityHubFeedTab) => visitedTabs.has(tab),
  };
}
