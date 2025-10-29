'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { VerticalSidebar, ContextTopBar } from '@/components/organisms';
import { CommentsColumn } from '@/components/organisms/CommentsColumn';
import { VotingPopup } from '@/components/organisms/VotingPopup';

export interface AdaptiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  communityId?: string;
  balance?: any;
  updBalance?: () => Promise<void>;
  wallets?: any[];
  updateWalletBalance?: (communityId: string, change: number) => void;
  updateAll?: () => Promise<void>;
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
  updBalance = async () => {},
  wallets = [],
  updateWalletBalance = () => {},
  updateAll = async () => {},
  myId,
  highlightTransactionId,
  activeCommentHook = [null, () => {}],
  activeSlider,
  setActiveSlider = () => {},
  activeWithdrawPost,
  setActiveWithdrawPost = () => {},
}) => {
  const searchParams = useSearchParams();
  const selectedPostSlug = searchParams.get('post');
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
            className={`transition-all duration-300 ${
              showCommentsColumn 
                ? 'flex-1 lg:mr-[400px]' // Make room for comments column when shown
                : 'flex-1' // Take full width, start from left
            }`}
          >
            <main className="px-4 py-6">
              {children}
            </main>
          </div>

          {/* Right Column - Comments (Desktop only) */}
          {showCommentsColumn && (
            <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[400px] bg-base-100 border-l border-base-300 z-20 transition-all duration-300">
              <CommentsColumn
                publicationSlug={selectedPostSlug!}
                communityId={communityId!}
                balance={balance}
                updBalance={updBalance}
                wallets={wallets}
                updateWalletBalance={updateWalletBalance}
                updateAll={updateAll}
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
                  const params = new URLSearchParams(searchParams.toString());
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
            updBalance={updBalance}
            wallets={wallets}
            updateWalletBalance={updateWalletBalance}
            updateAll={updateAll}
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
              const params = new URLSearchParams(searchParams.toString());
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
        updateWalletBalance={updateWalletBalance}
        updBalance={updBalance}
      />
    </div>
  );
};

