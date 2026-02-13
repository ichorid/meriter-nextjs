// PostActions: bottom action buttons (Fav, Share, Vote, Invest, Withdraw, etc.)
'use client';

import React from 'react';
import { Hand, Share2, Plus, Minus } from 'lucide-react';
import { FavoriteStar } from '@/components/atoms';
import { InvestButton } from '@/components/organisms/InvestButton';
import { ClosingSummaryBlock } from './ClosingSummaryBlock';
import { formatMerits } from '@/lib/utils/currency';

export interface ClosingSummary {
  totalEarned: number;
  distributedToInvestors: number;
  authorReceived: number;
  spentOnShows: number;
}

interface PostActionsProps {
  // Favorite
  publicationIdForFavorite: string | undefined;
  targetType: 'project' | 'publication';

  // Share
  communityId: string | undefined;
  hasShareUrl: boolean;
  onShareClick: (e: React.MouseEvent) => void;

  // Dev buttons (test mode, superadmin only)
  showDevButtons: boolean;
  isAddingVote: boolean;
  isAddingNegativeVote: boolean;
  onDevAddPositiveVote: () => void;
  onDevAddNegativeVote: () => void;

  // Closed state
  isClosed: boolean;
  closingSummary: ClosingSummary | undefined;
  onCommentOnlyClick: () => void;

  // Active state
  hideVoteAndScore: boolean;
  onCommentClick: (e: React.MouseEvent) => void;
  currentScore: number;
  totalVotes: number | undefined;
  totalVotesTooltip: string;

  // Invest
  showInvestButton: boolean;
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

  // Withdraw
  showWithdrawButton: boolean;
  onWithdrawClick: () => void;
  allowWithdraw: boolean;
  maxWithdrawAmount: number;
  withdrawDisabledTitle: string | undefined;

  // Vote
  showVoteButton: boolean;
  canVote: boolean;
  onVoteClick: () => void;
  voteTooltipText: string | undefined;

  // i18n
  shareTitle: string;
  commentsTitle: string;
  voteLabel: string;
  withdrawLabel: string;
  cannotWithdrawInCommunity: string;
  noVotesToWithdraw: string;
}

export const PostActions: React.FC<PostActionsProps> = ({
  publicationIdForFavorite,
  targetType,
  communityId,
  hasShareUrl,
  onShareClick,
  showDevButtons,
  isAddingVote,
  isAddingNegativeVote,
  onDevAddPositiveVote,
  onDevAddNegativeVote,
  isClosed,
  closingSummary,
  onCommentOnlyClick,
  hideVoteAndScore,
  onCommentClick,
  currentScore,
  totalVotes,
  totalVotesTooltip,
  showInvestButton,
  investButtonProps,
  showWithdrawButton,
  onWithdrawClick,
  allowWithdraw,
  maxWithdrawAmount,
  withdrawDisabledTitle,
  showVoteButton,
  canVote,
  onVoteClick,
  voteTooltipText,
  shareTitle,
  commentsTitle,
  voteLabel,
  withdrawLabel,
  cannotWithdrawInCommunity,
  noVotesToWithdraw,
}) => {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left side: Favorite, Share, Dev Add Vote */}
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

        {showDevButtons && (
          <>
            <button
              onClick={onDevAddPositiveVote}
              disabled={isAddingVote || isAddingNegativeVote}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Добавить +10 рейтинга от фейкового пользователя (DEV)"
            >
              <Plus className={`w-4 h-4 ${isAddingVote ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onDevAddNegativeVote}
              disabled={isAddingVote || isAddingNegativeVote}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Добавить -10 рейтинга от фейкового пользователя (DEV)"
            >
              <Minus className={`w-4 h-4 ${isAddingNegativeVote ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      </div>

      {/* Center: when closed show ClosingSummaryBlock + Comment; else score/invest/withdraw */}
      {isClosed ? (
        <div className="flex flex-col items-center gap-2">
          {closingSummary ? (
            <ClosingSummaryBlock summary={closingSummary} />
          ) : (
            <span className="text-sm text-base-content/50">Closed</span>
          )}
          <button
            onClick={onCommentOnlyClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-base-200 transition-all active:scale-95"
            title={commentsTitle}
          >
            <Hand className="w-4 h-4 text-base-content/50" />
            <span className="text-sm font-medium text-base-content/70">{commentsTitle}</span>
          </button>
        </div>
      ) : !hideVoteAndScore ? (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onCommentClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-base-200 transition-all active:scale-95 group"
            title={commentsTitle}
          >
            <Hand className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 transition-colors" />
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-semibold tabular-nums transition-colors ${
                  currentScore > 0
                    ? 'text-success group-hover:text-success/80'
                    : currentScore < 0
                      ? 'text-error group-hover:text-error/80'
                      : 'text-base-content/40 group-hover:text-base-content/60'
                }`}
              >
                {currentScore > 0 ? '+' : ''}
                {formatMerits(currentScore)}
              </span>
              {totalVotes !== undefined &&
                typeof totalVotes === 'number' &&
                !Number.isNaN(totalVotes) &&
                typeof currentScore === 'number' &&
                !Number.isNaN(currentScore) &&
                totalVotes > currentScore && (
                  <span
                    className="text-base-content/40 text-sm font-medium tabular-nums group-hover:text-base-content/50 transition-colors"
                    title={totalVotesTooltip}
                  >
                    ({totalVotes > 0 ? '+' : ''}
                    {formatMerits(totalVotes)})
                  </span>
                )}
            </div>
          </button>

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
            />
          )}

          {showWithdrawButton && (
            <button
              onClick={onWithdrawClick}
              disabled={!allowWithdraw || maxWithdrawAmount <= 0}
              className={`h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                !allowWithdraw || maxWithdrawAmount <= 0
                  ? 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
                  : 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
              }`}
              title={withdrawDisabledTitle}
            >
              {withdrawLabel}
            </button>
          )}
        </div>
      ) : null}

      {/* Right side: Vote button */}
      {showVoteButton && (
        <div className="flex items-center">
          <button
            onClick={onVoteClick}
            disabled={!canVote}
            className={`h-8 px-4 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
              canVote
                ? 'bg-base-content text-base-100 hover:bg-base-content/90 active:scale-95'
                : 'bg-gray-200 dark:bg-gray-700 text-base-content/60 cursor-not-allowed'
            }`}
            title={voteTooltipText}
          >
            <Hand className={`w-4 h-4 ${canVote ? 'text-base-100' : 'text-base-content/60'}`} />
            {voteLabel}
          </button>
        </div>
      )}
    </div>
  );
};
