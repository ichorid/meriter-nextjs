'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Same rules as bottom-nav FAB: CreateMenu only inside /meriter/communities/[id]/…
 * excluding members, settings, create, and events subtrees.
 */
export function useMeriterCommunityCreateContext(): {
  communityContextId: string | null;
  /** Desktop sidebar: show community CreateMenu when URL allows (hub root included). */
  shouldShowCreateMenu: boolean;
  /** Bottom-nav FAB: hidden on `/meriter/communities/[id]` hub where the feed toolbar exposes create. */
  shouldShowFabCreateMenu: boolean;
} {
  const pathname = usePathname();

  const communityContextId = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/\/meriter\/communities\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const isCommunityHubRoot = Boolean(
    pathname && /^\/meriter\/communities\/[^/]+$/.test(pathname),
  );

  const shouldShowCreateMenu = useMemo(() => {
    if (!pathname || !communityContextId) return false;
    const isMembersPage = pathname.includes('/members');
    const isSettingsPage = pathname.includes('/settings');
    const isCreatePage = pathname.includes('/create');
    const isEventsPage = pathname.includes('/events');
    return !isMembersPage && !isSettingsPage && !isCreatePage && !isEventsPage;
  }, [pathname, communityContextId]);

  const shouldShowFabCreateMenu = useMemo(
    () => Boolean(shouldShowCreateMenu && !isCommunityHubRoot),
    [shouldShowCreateMenu, isCommunityHubRoot],
  );

  return { communityContextId, shouldShowCreateMenu, shouldShowFabCreateMenu };
}
