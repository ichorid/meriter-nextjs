// PostActions: context-aware action buttons by role and post status (E-3)
// Author + Active: [★ Fav] [↗ Share] [+ Add merits] [↓ Withdraw] [⋯ More]
// User + Active: [★ Fav] [↗ Share] [💰 Invest (if enabled)] [💬 Vote]
// Any + Closed: [★ Fav] [↗ Share] [💬 Comment]
// Admin +/-: in ⋯ More menu
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Hand, Share2, MoreHorizontal, Lock, Settings, Plus, Minus, ArrowDownToLine } from 'lucide-react';
import { FavoriteStar } from '@/components/atoms';
import { InvestButton } from '@/components/organisms/InvestButton';

interface PostActionsProps {
  // Role & status
  isAuthor: boolean;
  isBeneficiary: boolean;
  isClosed: boolean;
  hideVoteAndScore: boolean;

  // Favorite
  publicationIdForFavorite: string | undefined;
  targetType: 'project' | 'publication';

  // Share
  communityId: string | undefined;
  hasShareUrl: boolean;
  onShareClick: (e: React.MouseEvent) => void;

  // Closed: Comment (neutral only)
  onCommentOnlyClick: () => void;

  // Active: Author — Add merits, Withdraw, More (Close, Settings, admin +/-)
  showAddMerits: boolean;
  investButtonProps: {
    postId: string | undefined;
    communityId: string;
    isAuthor: boolean;
    investingEnabled: boolean;
    investorSharePercent: number;
    investmentPool: number;
    investmentPoolTotal: number;
    investorCount: number;
    walletBalance: number;
    onSuccess?: () => void;
  };
  showWithdrawButton: boolean;
  onWithdrawClick: () => void;
  allowWithdraw: boolean;
  maxWithdrawAmount: number;
  withdrawDisabledTitle: string | undefined;
  showMoreMenu: boolean;
  showCloseInMore: boolean;
  showSettingsInMore: boolean;
  onClosePostClick: () => void;
  onSettingsClick: () => void;

  // Active: User — Invest, Vote
  showInvestButton: boolean;
  showVoteButton: boolean;
  canVote: boolean;
  onVoteClick: () => void;
  voteTooltipText: string | undefined;

  // Admin (in More menu)
  showAdminButtons: boolean;
  isAddingVote: boolean;
  isAddingNegativeVote: boolean;
  onDevAddPositiveVote: () => void;
  onDevAddNegativeVote: () => void;

  // i18n
  shareTitle: string;
  commentsTitle: string;
  voteLabel: string;
  withdrawLabel: string;
  closePostTitle: string;
  settingsTitle: string;
}

export const PostActions: React.FC<PostActionsProps> = ({
  isAuthor,
  isBeneficiary,
  isClosed,
  hideVoteAndScore,
  publicationIdForFavorite,
  targetType,
  communityId,
  hasShareUrl,
  onShareClick,
  onCommentOnlyClick,
  showAddMerits,
  investButtonProps,
  showWithdrawButton,
  onWithdrawClick,
  allowWithdraw,
  maxWithdrawAmount,
  withdrawDisabledTitle,
  showMoreMenu,
  showCloseInMore,
  showSettingsInMore,
  onClosePostClick,
  onSettingsClick,
  showInvestButton,
  showVoteButton,
  canVote,
  onVoteClick,
  voteTooltipText,
  showAdminButtons,
  isAddingVote,
  isAddingNegativeVote,
  onDevAddPositiveVote,
  onDevAddNegativeVote,
  shareTitle,
  commentsTitle,
  voteLabel,
  withdrawLabel,
  closePostTitle,
  settingsTitle,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  // Left: Fav, Share (always)
  const leftButtons = (
    <div className="flex items-center gap-4">
      {publicationIdForFavorite && (
        <FavoriteStar targetType={targetType} targetId={publicationIdForFavorite} />
      )}
      {communityId && hasShareUrl && (
        <button
          onClick={onShareClick}
          className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80"
          title={shareTitle}
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  // Center: varies by role and status
  const renderCenter = () => {
    if (isClosed) {
      return (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onCommentOnlyClick}
            className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-base-200 transition-all active:scale-95"
            title={commentsTitle}
          >
            <Hand className="w-4 h-4 shrink-0 text-base-content/50" />
            <span className="hidden sm:inline text-sm font-medium text-base-content/70">{commentsTitle}</span>
          </button>
        </div>
      );
    }

    if (hideVoteAndScore) return null;

    // Author + Active: More (left), Add merits, Withdraw
    if (isAuthor) {
      return (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {showMoreMenu && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreMenuOpen(!moreMenuOpen);
                }}
                className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80"
                title={settingsTitle}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-base-100 rounded-lg shadow-lg border border-base-300 py-1 z-50">
                  {showCloseInMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClosePostClick();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      {closePostTitle}
                    </button>
                  )}
                  {showSettingsInMore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSettingsClick();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      {settingsTitle}
                    </button>
                  )}
                  {showAdminButtons && (
                    <>
                      <div className="my-1 border-t border-base-300" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDevAddPositiveVote();
                          setMoreMenuOpen(false);
                        }}
                        disabled={isAddingVote || isAddingNegativeVote}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        +10 (admin)
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDevAddNegativeVote();
                          setMoreMenuOpen(false);
                        }}
                        disabled={isAddingVote || isAddingNegativeVote}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                        -10 (admin)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {showAddMerits && (
            <InvestButton
              postId={investButtonProps.postId}
              communityId={investButtonProps.communityId}
              isAuthor={investButtonProps.isAuthor}
              investingEnabled={investButtonProps.investingEnabled}
              investorSharePercent={investButtonProps.investorSharePercent}
              investmentPool={investButtonProps.investmentPool}
              investmentPoolTotal={investButtonProps.investmentPoolTotal}
              investorCount={investButtonProps.investorCount}
              walletBalance={investButtonProps.walletBalance}
              onSuccess={investButtonProps.onSuccess}
              iconOnlyOnMobile
            />
          )}
          {showWithdrawButton && (
            <button
              onClick={onWithdrawClick}
              disabled={!allowWithdraw || maxWithdrawAmount <= 0}
              className={`h-8 px-2 sm:px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                !allowWithdraw || maxWithdrawAmount <= 0
                  ? 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
                  : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
              }`}
              title={withdrawDisabledTitle ?? withdrawLabel}
            >
              <ArrowDownToLine className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{withdrawLabel}</span>
            </button>
          )}
        </div>
      );
    }

    // User + Active: Invest, Vote; Beneficiary also gets Withdraw
    // E-5: Admin +/- only in overflow - add More menu for non-authors when showAdminButtons
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showAdminButtons && (
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMoreMenuOpen(!moreMenuOpen);
              }}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80"
              title="Admin"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {moreMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-base-100 rounded-lg shadow-lg border border-base-300 py-1 z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDevAddPositiveVote();
                    setMoreMenuOpen(false);
                  }}
                  disabled={isAddingVote || isAddingNegativeVote}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  +10 (admin)
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDevAddNegativeVote();
                    setMoreMenuOpen(false);
                  }}
                  disabled={isAddingVote || isAddingNegativeVote}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-base-200 flex items-center gap-2 disabled:opacity-50"
                >
                  <Minus className="w-4 h-4" />
                  -10 (admin)
                </button>
              </div>
            )}
          </div>
        )}
        {showInvestButton && (
          <InvestButton
            postId={investButtonProps.postId}
            communityId={investButtonProps.communityId}
            isAuthor={investButtonProps.isAuthor}
            investingEnabled={investButtonProps.investingEnabled}
            investorSharePercent={investButtonProps.investorSharePercent}
            investmentPool={investButtonProps.investmentPool}
            investmentPoolTotal={investButtonProps.investmentPoolTotal}
            investorCount={investButtonProps.investorCount}
            walletBalance={investButtonProps.walletBalance}
            onSuccess={investButtonProps.onSuccess}
            iconOnlyOnMobile
          />
        )}
        {showVoteButton && (
          <button
            onClick={onVoteClick}
            disabled={!canVote}
            className={`h-8 px-2 sm:px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
              canVote
                ? 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                : 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
            }`}
            title={voteTooltipText ?? voteLabel}
          >
            <Hand className={`w-4 h-4 shrink-0 ${canVote ? 'text-base-100' : 'text-base-content/60'}`} />
            <span className="hidden sm:inline">{voteLabel}</span>
          </button>
        )}
        {showWithdrawButton && isBeneficiary && (
          <button
            onClick={onWithdrawClick}
            disabled={!allowWithdraw || maxWithdrawAmount <= 0}
            className={`h-8 px-2 sm:px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
              !allowWithdraw || maxWithdrawAmount <= 0
                ? 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
                : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
            }`}
            title={withdrawDisabledTitle ?? withdrawLabel}
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{withdrawLabel}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center justify-between gap-3">
      {leftButtons}
      {renderCenter()}
    </div>
  );
};
