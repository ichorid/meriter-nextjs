'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { VerticalSidebar, ContextTopBar } from '@/components/organisms';
import { CommentsColumn } from '@/components/organisms/CommentsColumn';
import { VotingPopup } from '@/components/organisms/VotingPopup';
import { WithdrawPopup } from '@/components/organisms/WithdrawPopup';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  activeCommentHook = [null, () => {}],
  activeSlider,
  setActiveSlider = () => {},
  activeWithdrawPost,
  setActiveWithdrawPost = () => {},
}) => {
  const searchParams = useSearchParams();
  const selectedPostSlug = searchParams?.get('post');
  const showComments = !!selectedPostSlug;

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
  
  // Calculate minimum required width: sidebar(280) + comments(400) + content(min ~600) = ~1280px
  // Below xl (1280px), shrink sidebar when comments shown

  // Resizable right column state management
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [rightColumnWidth, setRightColumnWidth] = useLocalStorage<number>('adaptive-layout-right-column-width', 400);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartWidth = useRef<number>(400);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constrain width: min 300px, max min(800px, 50vw)
  const clampWidth = useCallback((width: number): number => {
    if (typeof window === 'undefined') return width;
    const maxWidth = Math.min(800, window.innerWidth * 0.5);
    return Math.max(300, Math.min(maxWidth, width));
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div className={`min-h-screen flex ${className}`}>
      {/* Left Sidebar - Communities */}
      {/* Responsive behavior:
          - Mobile small (< 640px): Hide when comments shown (very cramped), show avatar-only otherwise
          - Mobile/Tablet (640px - lg): always avatar-only, fixed positioning
          - Desktop lg-xl (1024-1279px): expanded when no comments, avatar when comments shown
          - Desktop xl+ (≥1280px): always expanded (prioritize full-size on broad windows)
      */}
      {/* Mobile/Tablet (< lg): avatar-only, fixed positioning */}
      {/* On small screens (< 640px), hide when comments shown to save space */}
      {!showCommentsColumn && (
        <div className="flex lg:hidden flex-shrink-0">
          <VerticalSidebar isExpanded={false} />
        </div>
      )}
      {showCommentsColumn && (
        <div className="hidden sm:flex lg:hidden flex-shrink-0">
          <VerticalSidebar isExpanded={false} />
        </div>
      )}
      {/* Desktop lg-xl (1024-1279px): shrink to avatar when comments shown */}
      <div className="hidden lg:flex xl:hidden flex-shrink-0" style={{ width: sidebarExpandedDesktop ? '280px' : '72px' }}>
        <VerticalSidebar isExpanded={sidebarExpandedDesktop} />
      </div>
      {/* Desktop xl+ (≥1280px): always expanded (default, broad windows) */}
      <div className="hidden xl:flex flex-shrink-0 w-[280px]">
        <VerticalSidebar isExpanded={true} />
      </div>

      {/* Main Content Area */}
      {/* Padding needed where sidebar is fixed:
          - Mobile small (< 640px) with comments: No padding (sidebar hidden)
          - Mobile/Tablet: 72px (avatar-only sidebar)
          - Desktop: sidebar uses sticky positioning, takes natural space (no padding)
      */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        showCommentsColumn 
          ? 'pl-0 sm:pl-[72px] lg:pl-0' // No padding on small mobile when comments shown (sidebar hidden), 72px on larger mobile/tablet
          : 'pl-[72px] lg:pl-0' // 72px on mobile/tablet, no padding on desktop
      }`}>
        {/* Top Bar */}
        <ContextTopBar />
        
        {/* Content Wrapper - Flex container for posts and comments */}
        <div className="flex-1 flex relative">
          {/* Center Column - Posts */}
          <div 
            className={`transition-all duration-300 flex-1 sm:max-w-2xl lg:max-w-4xl ${
              showCommentsColumn 
                ? '' // Make room for comments column when shown via margin
                : 'mx-auto' // Center content when comments hidden
            }`}
            style={showCommentsColumn && isDesktop ? { marginRight: 'var(--right-column-width)' } : undefined}
          >
            <main className="px-4 py-6 max-w-[100vw - 73px]">
              {children}
            </main>
          </div>

          {/* Resizable Divider - Desktop only */}
          {showCommentsColumn && isDesktop && (
            <div
              role="separator"
              aria-label="Resize comments column"
              aria-orientation="vertical"
              className={`hidden lg:block absolute top-0 bottom-0 z-30 cursor-col-resize select-none transition-colors ${
                isDragging 
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
              className={`hidden lg:block absolute right-0 top-0 bottom-0 bg-base-100 border-l border-base-300 z-20 ${
                isDragging ? 'transition-none' : 'transition-all duration-300'
              }`}
              style={{ width: 'var(--right-column-width)' }}
            >
              <CommentsColumn
                publicationSlug={selectedPostSlug!}
                communityId={communityId!}
                balance={balance}
                wallets={wallets}
                myId={myId}
                highlightTransactionId={highlightTransactionId}
                activeCommentHook={activeCommentHook}
                activeSlider={activeSlider ?? null}
                setActiveSlider={setActiveSlider}
                activeWithdrawPost={activeWithdrawPost ?? null}
                setActiveWithdrawPost={setActiveWithdrawPost}
                showBackButton={true}
                onBack={() => {
                  // Remove post query param
                  const params = new URLSearchParams(searchParams?.toString() ?? '');
                  params.delete('post');
                  window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Comments Drawer */}
      {showComments && selectedPostSlug && communityId && (
        <div className="lg:hidden fixed inset-0 z-50 bg-base-100">
          <CommentsColumn
            publicationSlug={selectedPostSlug}
            communityId={communityId}
            balance={balance}
            wallets={wallets}
            myId={myId}
            highlightTransactionId={highlightTransactionId}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider ?? null}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost ?? null}
            setActiveWithdrawPost={setActiveWithdrawPost}
            showBackButton={true}
            onBack={() => {
              // Remove post query param
              const params = new URLSearchParams(searchParams?.toString() ?? '');
              params.delete('post');
              window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
            }}
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
    </div>
  );
};

