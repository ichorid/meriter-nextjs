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
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedPostSlug = searchParams?.get('post');
  const showComments = !!selectedPostSlug;
  const tCommon = useTranslations('common');

  // Comments state - controlled by URL param
  const commentsOpen = showComments && selectedPostSlug && communityId;

  // Comments column shows on desktop (lg) only
  const showCommentsColumn = showComments && selectedPostSlug && communityId;

  // Breakpoints: overlay on most screens; dock only on very wide
  const isUltraWide = useMediaQuery('(min-width: 1600px)');
  const inspectorMode = isUltraWide ? 'docked' : 'overlay';


  // Handler to close comments (remove post param from URL)
  const handleCloseComments = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('post');
    const newUrl = pathname + (params.toString() ? `?${params.toString()}` : '');
    router.push(newUrl);
  }, [searchParams, pathname, router]);

  return (
    <div 
      className={`appShell ${className}`}
      data-inspector-mode={inspectorMode}
      data-comments-open={commentsOpen}
    >
      {/* Header */}
      <div className="appHeader">
        <ContextTopBar />
      </div>

      {/* Body grid */}
      <div className="appBody">
        {/* Left Nav */}
        <aside className="leftNav hidden lg:block">
          <VerticalSidebar isExpanded={true} />
        </aside>

        {/* Main scroll container */}
        <div className="mainWrap">
          <div className="main">
            {/* Sticky Header - rendered inside main for proper sticky behavior */}
            {stickyHeader && (
              <div className="sticky top-0 z-20 bg-base-100 -mx-4 -mt-6 mb-4 px-4 pt-6">
                {stickyHeader}
              </div>
            )}
            {children}
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

      {/* Overlay inspector (used on most screens) */}
      {inspectorMode === 'overlay' && (
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

      {/* Mobile Comments Drawer */}
      {showComments && selectedPostSlug && communityId && (
        <div className="lg:hidden fixed inset-0 z-50 bg-base-100 flex flex-col overflow-hidden">
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
      <BottomNavigation />
    </div>
  );
};

