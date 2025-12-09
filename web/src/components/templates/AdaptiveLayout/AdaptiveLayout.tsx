'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  activeSlider?: string | null;
  setActiveSlider?: (id: string | null) => void;
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
  activeSlider,
  setActiveSlider = () => { },
  activeWithdrawPost,
  setActiveWithdrawPost = () => { },
  stickyHeader,
}) => {
  const searchParams = useSearchParams();
  const selectedPostSlug = searchParams?.get('post');
  const showComments = !!selectedPostSlug;
  const tCommon = useTranslations('common');

  // Comments column shows on desktop (lg) only
  const showCommentsColumn = showComments && selectedPostSlug && communityId;

  // Sidebar responsive behavior when comments are shown:
  // - xl+ (≥1280px): Keep expanded (default, prioritize full-size on broad windows)
  // - lg-xl (1024-1279px): Shrink to avatar-only (medium desktop, constrained space)
  // - < lg: Always avatar-only (mobile/tablet)
  // When comments NOT shown:
  // - lg+: Expanded
  // - < lg: Avatar-only
  const sidebarExpandedDesktop = !showCommentsColumn;

  // Calculate minimum required width: sidebar(336) + comments(400) + content(min ~600) = ~1336px
  // Below xl (1280px), shrink sidebar when comments shown

  // Resizable right column state management
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [rightColumnWidth, setRightColumnWidth] = useLocalStorage<number>('adaptive-layout-right-column-width', 400);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(400);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resizable left sidebar state management
  const [leftSidebarWidth, setLeftSidebarWidth] = useLocalStorage<number>('adaptive-layout-left-sidebar-width', 336);
  const [isDraggingLeftSidebar, setIsDraggingLeftSidebar] = useState(false);
  const dragStartXLeftSidebar = useRef<number>(0);
  const dragStartWidthLeftSidebar = useRef<number>(336);
  const saveTimeoutRefLeftSidebar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constrain width: min 300px, max min(800px, 50vw)
  const clampWidth = useCallback((width: number): number => {
    if (typeof window === 'undefined') return width;
    const maxWidth = Math.min(800, window.innerWidth * 0.5);
    return Math.max(300, Math.min(maxWidth, width));
  }, []);

  // Constrain left sidebar width: min 200px, max 600px
  const clampLeftSidebarWidth = useCallback((width: number): number => {
    if (typeof window === 'undefined') return width;
    return Math.max(200, Math.min(600, width));
  }, []);

  // Validate and clamp saved width on mount and window resize
  useEffect(() => {
    if (!isDesktop || !showCommentsColumn) return;

    const validateWidth = () => {
      const clamped = clampWidth(rightColumnWidth);
      if (clamped !== rightColumnWidth) {
        setRightColumnWidth(clamped);
      }
    };

    // Validate on mount
    validateWidth();

    // Validate on window resize
    window.addEventListener('resize', validateWidth);
    return () => window.removeEventListener('resize', validateWidth);
  }, [isDesktop, showCommentsColumn, rightColumnWidth, clampWidth, setRightColumnWidth]); // rightColumnWidth check prevents infinite loops

  // Update CSS variable for right column width
  useEffect(() => {
    if (!isDesktop || !showCommentsColumn) {
      // Reset to default when not on desktop or comments hidden
      document.documentElement.style.setProperty('--right-column-width', '400px');
      return;
    }

    const clampedWidth = clampWidth(rightColumnWidth);
    document.documentElement.style.setProperty('--right-column-width', `${clampedWidth}px`);
  }, [rightColumnWidth, isDesktop, showCommentsColumn, clampWidth]);

  // Validate and clamp saved left sidebar width on mount and window resize
  useEffect(() => {
    if (!isDesktop) return;

    const validateWidth = () => {
      const clamped = clampLeftSidebarWidth(leftSidebarWidth);
      if (clamped !== leftSidebarWidth) {
        setLeftSidebarWidth(clamped);
      }
    };

    // Validate on mount
    validateWidth();

    // Validate on window resize
    window.addEventListener('resize', validateWidth);
    return () => window.removeEventListener('resize', validateWidth);
  }, [isDesktop, leftSidebarWidth, clampLeftSidebarWidth, setLeftSidebarWidth]);

  // Update CSS variable for left sidebar width
  useEffect(() => {
    if (!isDesktop) {
      // Reset to default when not on desktop
      document.documentElement.style.setProperty('--left-sidebar-width', '336px');
      return;
    }

    const clampedWidth = clampLeftSidebarWidth(leftSidebarWidth);
    document.documentElement.style.setProperty('--left-sidebar-width', `${clampedWidth}px`);
  }, [leftSidebarWidth, isDesktop, clampLeftSidebarWidth]);

  // Debounced localStorage save on drag end
  const saveWidth = useCallback((width: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      const clamped = clampWidth(width);
      setRightColumnWidth(clamped);
      saveTimeoutRef.current = null;
    }, 500);
  }, [clampWidth, setRightColumnWidth]);

  // Mouse event handlers for resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDesktop || !showCommentsColumn) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = rightColumnWidth;

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [isDesktop, showCommentsColumn, rightColumnWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !isDesktop || !showCommentsColumn) return;

    requestAnimationFrame(() => {
      const deltaX = dragStartX.current - e.clientX; // Negative delta = drag left = increase width
      const newWidth = dragStartWidth.current + deltaX;
      const clampedWidth = clampWidth(newWidth);

      // Update CSS variable directly for smooth drag (no state update during drag)
      document.documentElement.style.setProperty('--right-column-width', `${clampedWidth}px`);
    });
  }, [isDragging, isDesktop, showCommentsColumn, clampWidth]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Restore cursor and selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // Get current width from CSS variable and update state
    const currentWidth = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--right-column-width')
    ) || rightColumnWidth;

    const clamped = clampWidth(currentWidth);
    setRightColumnWidth(clamped);

    // Debounced save for persistence
    saveWidth(clamped);
  }, [isDragging, rightColumnWidth, clampWidth, setRightColumnWidth, saveWidth]);

  // Attach/remove mouse event listeners
  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Debounced localStorage save for left sidebar on drag end
  const saveLeftSidebarWidth = useCallback((width: number) => {
    if (saveTimeoutRefLeftSidebar.current) {
      clearTimeout(saveTimeoutRefLeftSidebar.current);
    }
    saveTimeoutRefLeftSidebar.current = setTimeout(() => {
      const clamped = clampLeftSidebarWidth(width);
      setLeftSidebarWidth(clamped);
      saveTimeoutRefLeftSidebar.current = null;
    }, 500);
  }, [clampLeftSidebarWidth, setLeftSidebarWidth]);

  // Mouse event handlers for resizing left sidebar
  const handleLeftSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDesktop) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeftSidebar(true);
    dragStartXLeftSidebar.current = e.clientX;
    dragStartWidthLeftSidebar.current = leftSidebarWidth;

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [isDesktop, leftSidebarWidth]);

  const handleLeftSidebarMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingLeftSidebar || !isDesktop) return;

    requestAnimationFrame(() => {
      const deltaX = e.clientX - dragStartXLeftSidebar.current; // Positive delta = drag right = increase width
      const newWidth = dragStartWidthLeftSidebar.current + deltaX;
      const clampedWidth = clampLeftSidebarWidth(newWidth);

      // Update CSS variable directly for smooth drag (no state update during drag)
      document.documentElement.style.setProperty('--left-sidebar-width', `${clampedWidth}px`);
    });
  }, [isDraggingLeftSidebar, isDesktop, clampLeftSidebarWidth]);

  const handleLeftSidebarMouseUp = useCallback(() => {
    if (!isDraggingLeftSidebar) return;

    setIsDraggingLeftSidebar(false);

    // Restore cursor and selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // Get current width from CSS variable and update state
    const currentWidth = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--left-sidebar-width')
    ) || leftSidebarWidth;

    const clamped = clampLeftSidebarWidth(currentWidth);
    setLeftSidebarWidth(clamped);

    // Debounced save for persistence
    saveLeftSidebarWidth(clamped);
  }, [isDraggingLeftSidebar, leftSidebarWidth, clampLeftSidebarWidth, setLeftSidebarWidth, saveLeftSidebarWidth]);

  // Attach/remove mouse event listeners for left sidebar
  useEffect(() => {
    if (!isDraggingLeftSidebar) return;

    document.addEventListener('mousemove', handleLeftSidebarMouseMove);
    document.addEventListener('mouseup', handleLeftSidebarMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleLeftSidebarMouseMove);
      document.removeEventListener('mouseup', handleLeftSidebarMouseUp);
    };
  }, [isDraggingLeftSidebar, handleLeftSidebarMouseMove, handleLeftSidebarMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (saveTimeoutRefLeftSidebar.current) {
        clearTimeout(saveTimeoutRefLeftSidebar.current);
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div className={`h-screen max-h-screen flex overflow-hidden ${className}`}>
      {/* Left Sidebar - Communities */}
      {/* Responsive behavior:
          - Mobile/Tablet (< lg): Hidden when BottomNavigation is visible (same breakpoint)
          - Desktop lg-xl (1024-1279px): expanded when no comments, avatar when comments shown
          - Desktop xl+ (≥1280px): always expanded (prioritize full-size on broad windows)
      */}
      {/* Mobile/Tablet sidebar is hidden when BottomNavigation is shown (both use lg:hidden breakpoint) */}
      {/* Desktop lg-xl (1024-1279px): shrink to avatar when comments shown */}
      <div className="hidden lg:flex xl:hidden flex-shrink-0 relative" style={{ width: sidebarExpandedDesktop ? 'var(--left-sidebar-width, 336px)' : '72px' }}>
        <VerticalSidebar isExpanded={sidebarExpandedDesktop} />
        {/* Resizable Divider - Desktop only, when expanded */}
        {sidebarExpandedDesktop && isDesktop && (
          <div
            role="separator"
            aria-label={tCommon('resizeSidebar')}
            aria-orientation="vertical"
            className={`absolute top-0 bottom-0 right-0 z-30 cursor-col-resize select-none transition-colors ${
              isDraggingLeftSidebar
                ? 'bg-base-300/80'
                : 'bg-transparent hover:bg-base-300/50'
              }`}
            style={{
              marginLeft: '-6px',
              marginRight: '-6px',
              width: '12px'
            }}
            onMouseDown={handleLeftSidebarMouseDown}
          />
        )}
      </div>
      {/* Desktop xl+ (≥1280px): always expanded (default, broad windows) */}
      <div className="hidden xl:flex flex-shrink-0 relative" style={{ width: 'var(--left-sidebar-width, 336px)' }}>
        <VerticalSidebar isExpanded={true} />
        {/* Resizable Divider - Desktop only */}
        {isDesktop && (
          <div
            role="separator"
            aria-label={tCommon('resizeSidebar')}
            aria-orientation="vertical"
            className={`absolute top-0 bottom-0 right-0 z-30 cursor-col-resize select-none transition-colors ${
              isDraggingLeftSidebar
                ? 'bg-base-300/80'
                : 'bg-transparent hover:bg-base-300/50'
              }`}
            style={{
              marginLeft: '-6px',
              marginRight: '-6px',
              width: '12px'
            }}
            onMouseDown={handleLeftSidebarMouseDown}
          />
        )}
      </div>

      {/* Main Content Area */}
      {/* Padding needed where sidebar is fixed:
          - Mobile/Tablet (< lg): No padding (sidebar hidden when BottomNavigation is visible)
          - Desktop: sidebar uses sticky positioning, takes natural space (no padding)
      */}
      <div className={`flex-1 flex flex-col transition-all duration-300 lg:pl-0 min-w-0 overflow-hidden`}>
        {/* Top Bar */}
        <ContextTopBar />

        {/* Content Wrapper - Flex container for posts and comments */}
        <div className="flex-1 flex relative overflow-hidden">
          {/* Center Column - Posts */}
          <div
            className={`transition-all duration-300 flex-1 min-w-0 overflow-y-auto overflow-x-hidden sm:max-w-2xl lg:max-w-4xl ${showCommentsColumn
              ? '' // Make room for comments column when shown via margin
              : 'mx-auto' // Center content when comments hidden
              }`}
            style={showCommentsColumn && isDesktop ? { marginRight: 'var(--right-column-width)' } : undefined}
          >
            {/* Sticky Header - rendered outside main for proper sticky behavior */}
            {stickyHeader && (
              <div className="sticky top-0 z-20 bg-base-100">
                {stickyHeader}
              </div>
            )}
            <main className="px-4 py-6 pb-20 lg:pb-6 bg-base-100 max-w-full">
              {children}
            </main>
          </div>

          {/* Resizable Divider - Desktop only */}
          {showCommentsColumn && isDesktop && (
            <div
              role="separator"
              aria-label={tCommon('resizeCommentsColumn')}
              aria-orientation="vertical"
              className={`hidden lg:block absolute top-0 bottom-0 z-30 cursor-col-resize select-none transition-colors ${isDragging
                ? 'bg-base-300/80'
                : 'bg-transparent hover:bg-base-300/50'
                }`}
              style={{
                right: 'var(--right-column-width)',
                marginLeft: '-6px',
                marginRight: '-6px',
                width: '12px'
              }}
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Right Column - Comments (Desktop only) */}
          {showCommentsColumn && (
            <div
              className={`hidden lg:flex lg:flex-col absolute right-0 top-0 bottom-0 bg-base-100 border-l border-base-300 z-20 overflow-hidden ${isDragging ? 'transition-none' : 'transition-all duration-300'
                }`}
              style={{ width: 'var(--right-column-width)' }}
            >
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
                    activeSlider: activeSlider ?? null,
                    setActiveSlider: setActiveSlider || (() => { }),
                    activeWithdrawPost: activeWithdrawPost ?? null,
                    setActiveWithdrawPost: setActiveWithdrawPost || (() => { }),
                  }
                )}
              />
            </div>
          )}
        </div>
      </div>

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
                activeSlider: activeSlider ?? null,
                setActiveSlider: setActiveSlider || (() => { }),
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

