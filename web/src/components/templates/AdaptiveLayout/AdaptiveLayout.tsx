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

  return (
    <div className={`min-h-screen flex ${className}`}>
      {/* Left Sidebar - Communities */}
      {/* Hidden on mobile, avatar-only on tablet (md), expanded on desktop (lg) */}
      {/* Use separate instances for responsive behavior */}
      <div className="hidden md:flex lg:hidden">
        <VerticalSidebar isExpanded={false} />
      </div>
      <div className="hidden lg:flex">
        <VerticalSidebar isExpanded={true} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col transition-all duration-300 md:pl-[72px] lg:pl-[280px]">
        {/* Top Bar */}
        <ContextTopBar />
        
        {/* Content Wrapper - Flex container for posts and comments */}
        <div className="flex-1 flex relative">
          {/* Center Column - Posts */}
          <div 
            className={`flex-1 transition-all duration-300 ${
              showCommentsColumn 
                ? 'lg:mr-[400px]' // Make room for comments column when shown
                : 'max-w-2xl mx-auto lg:mx-auto' // Center when no comments
            }`}
          >
            <main className="container mx-auto px-4 py-6">
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

