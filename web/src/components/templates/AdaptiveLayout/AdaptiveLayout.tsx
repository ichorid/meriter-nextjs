'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { VerticalSidebar, ContextTopBar, BottomNavigation } from '@/components/organisms';
import { CommentsColumn } from '@/components/organisms/CommentsColumn';
import { VotingPopup } from '@/components/organisms/VotingPopup';
import { WithdrawPopup } from '@/components/organisms/WithdrawPopup';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { createCommentsColumnProps } from './helpers';

export interface AdaptiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  communityId?: string;
  balance?: any;
  wallets?: any[];
  myId?: string;
  highlightTransactionId?: string;
  activeCommentHook?: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (id: string | null) => void;
  /** Sticky header that stays at top of scroll area */
  stickyHeader?: React.ReactNode;
  /** Custom tabs for mobile bottom navigation */
  bottomNavTabs?: any[];
}

/**
 * Adaptive 3-column layout component
 * - Desktop (lg: ≥1024px): 3 columns (communities expanded | posts | comments)
 * - Tablet (md: 768px - 1023px): 2 columns (communities avatars | posts)
 * - Mobile (< 768px): Single column (posts), comments in drawer
 */
export const AdaptiveLayout: React.FC<AdaptiveLayoutProps> = ({
  children,
  className = '',
  communityId,
  balance,
  wallets = [],
  myId,
  highlightTransactionId,
  activeCommentHook = [null, () => { }],
  activeWithdrawPost,
  setActiveWithdrawPost = () => { },
  stickyHeader,
  bottomNavTabs,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedPostSlug = searchParams?.get('post');
  const showComments = !!selectedPostSlug;
  const tCommon = useTranslations('common');

  // Comments state - controlled by URL param
  const commentsOpen = !!(showComments && selectedPostSlug && communityId);

  // Comments column shows on desktop (lg) only
  const showCommentsColumn = !!(showComments && selectedPostSlug && communityId);

  // Breakpoints: overlay on most screens; dock only on very wide
  // Note: CSS hides overlay at max-width: 1023px, so tablet is 768px - 1023px
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // lg breakpoint ≥1024px
  const isMobile = useMediaQuery('(max-width: 767px)'); // < 768px
  const isTablet = !isDesktop && !isMobile; // 768px - 1023px
  const isUltraWide = useMediaQuery('(min-width: 1600px)');
  const inspectorMode = isUltraWide ? 'docked' : 'overlay';

  // In tablet mode (768-1023px), if comments are open, replace center content with comments
  // CSS hides the overlay at max-width: 1023px, so tablet needs center replacement
  const showCommentsInCenter = isTablet && showComments && selectedPostSlug && communityId;

  // Overlay should only show on desktop (≥1024px), not on tablet where CSS hides it anyway
  const canShowOverlay = isDesktop && !isTablet;

  // Debug logging
  if (process.env.NODE_ENV !== 'production' && selectedPostSlug) {
    console.log('[AdaptiveLayout] Comments sidebar state:', JSON.stringify({
      selectedPostSlug,
      showComments,
      commentsOpen: !!commentsOpen,
      showCommentsColumn: !!showCommentsColumn,
      communityId,
      isDesktop,
      isTablet,
      isMobile,
      isUltraWide,
      inspectorMode,
      showCommentsInCenter,
      windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'SSR',
    }, null, 2));
  }


  // Handler to close comments (remove post param from URL)
  const handleCloseComments = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('post');
    const newUrl = pathname + (params.toString() ? `?${params.toString()}` : '');
    router.push(newUrl);
  }, [searchParams, pathname, router]);

  // Determine if header should be shown (same logic as ContextTopBar)
  // Community pages use stickyHeader prop instead, so exclude them from appHeader
  const shouldShowHeader = React.useMemo(() => {
    if (!pathname || pathname.includes('/login')) return false;

    const isProfileMainPage = pathname === '/meriter/profile';
    const isProfileSubPage = pathname?.startsWith('/meriter/profile/');
    const isSettingsPage = pathname === '/meriter/settings';
    const isCommunityPage = pathname?.match(/\/meriter\/communities\/([^\/]+)$/);
    const isPostDetailPage = pathname?.match(/\/meriter\/communities\/([^\/]+)\/posts\/(.+)/);

    if (isPostDetailPage || isProfileMainPage || isSettingsPage || isCommunityPage || isProfileSubPage) return false;

    return false;
  }, [pathname]);

  return (
    <div
      className={`appShell ${className}`}
      data-inspector-mode={inspectorMode}
      data-comments-open={commentsOpen}
      data-header-visible={shouldShowHeader}
    >
      {/* Header - only render when ContextTopBar has content */}
      {shouldShowHeader && (
        <div className="appHeader">
          <ContextTopBar />
        </div>
      )}

      {/* Body grid */}
      <div className="appBody">
        {/* Left Nav */}
        <aside className="leftNav hidden lg:block">
          <VerticalSidebar isExpanded={true} />
        </aside>

        {/* Main scroll container */}
        <div className="mainWrap">
          <div className="main pb-24 lg:pb-0">
            {/* Sticky Header - rendered inside main for proper sticky behavior */}
            {stickyHeader && !showCommentsInCenter && (
              <div className="sticky top-0 z-20 bg-base-100 -mx-4 -mt-6 mb-4 px-4">
                {stickyHeader}
              </div>
            )}
            {/* In tablet mode, replace content with comments when post is selected */}
            {showCommentsInCenter ? (
              <CommentsColumn
                {...createCommentsColumnProps(
                  selectedPostSlug!,
                  communityId!,
                  searchParams,
                  {
                    balance: balance!,
                    wallets: wallets || [],
                    myId,
                    highlightTransactionId,
                    activeCommentHook: activeCommentHook || [null, () => { }],
                    activeWithdrawPost: activeWithdrawPost ?? null,
                    setActiveWithdrawPost: setActiveWithdrawPost || (() => { }),
                  }
                )}
              />
            ) : (
              children
            )}
          </div>
        </div>

        {/* Docked inspector column (only used on ultra-wide) */}
        {inspectorMode === 'docked' && showCommentsColumn && (
          <aside className="inspectorDock">
            <CommentsColumn
              {...createCommentsColumnProps(
                selectedPostSlug!,
                communityId!,
                searchParams,
                {
                  balance: balance!,
                  wallets: wallets || [],
                  myId,
                  highlightTransactionId,
                  activeCommentHook: activeCommentHook || [null, () => { }],
                  activeWithdrawPost: activeWithdrawPost ?? null,
                  setActiveWithdrawPost: setActiveWithdrawPost || (() => { }),
                }
              )}
            />
          </aside>
        )}
      </div>

      {/* Overlay inspector (used on desktop ≥1024px, but not ultra-wide) */}
      {/* Note: CSS hides overlay at max-width: 1023px, so this only renders when visible */}
      {inspectorMode === 'overlay' && canShowOverlay && (
        <>
          <div
            className="inspectorOverlay"
            role="dialog"
            aria-hidden={!commentsOpen}
          >
            {showCommentsColumn && (
              <CommentsColumn
                {...createCommentsColumnProps(
                  selectedPostSlug!,
                  communityId!,
                  searchParams,
                  {
                    balance: balance!,
                    wallets: wallets || [],
                    myId,
                    highlightTransactionId,
                    activeCommentHook: activeCommentHook || [null, () => { }],
                    activeWithdrawPost: activeWithdrawPost ?? null,
                    setActiveWithdrawPost: setActiveWithdrawPost || (() => { }),
                  }
                )}
              />
            )}
          </div>
          <div
            className="scrim"
            onClick={handleCloseComments}
            aria-hidden={!commentsOpen}
          />
        </>
      )}

      {/* Mobile Comments Drawer (only on mobile, not tablet) */}
      {isMobile && showComments && selectedPostSlug && communityId && (
        <div className="fixed inset-0 z-50 bg-base-100 flex flex-col overflow-hidden">
          <CommentsColumn
            {...createCommentsColumnProps(
              selectedPostSlug,
              communityId,
              searchParams,
              {
                balance: balance!,
                wallets: wallets || [],
                myId,
                highlightTransactionId,
                activeCommentHook: activeCommentHook || [null, () => { }],
                activeWithdrawPost: activeWithdrawPost ?? null,
                setActiveWithdrawPost: setActiveWithdrawPost || (() => { }),
              }
            )}
          />
        </div>
      )}

      {/* Bottom Widget Area - for BottomPortal to render forms */}
      <div className="bottom-widget-area fixed inset-0 z-50 pointer-events-none touch-none" />

      {/* Global Voting Popup */}
      <VotingPopup
        communityId={communityId}
      />

      {/* Global Withdraw Popup */}
      <WithdrawPopup
        communityId={communityId}
      />

      {/* Mobile Bottom Navigation */}
      <BottomNavigation customTabs={bottomNavTabs} />
    </div>
  );
};

