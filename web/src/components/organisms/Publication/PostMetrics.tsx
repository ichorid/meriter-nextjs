// PostMetrics: rating display, investment info, TTL badge (E-1 placeholder, enhanced in E-2)
'use client';

import React from 'react';
import { InvestmentBreakdownPopup } from '@/components/organisms/InvestmentBreakdownPopup';

interface PostMetricsProps {
  /** Investment block: compact, clickable → breakdown popup */
  investingEnabled: boolean;
  isClosed: boolean;
  investmentPool: number;
  investorCount: number;
  publicationId: string | undefined;
  breakdownPostId: string | null;
  onBreakdownClick: (e: React.MouseEvent) => void;
  onBreakdownOpenChange: (open: boolean) => void;
  investorsLabel: string;
  viewBreakdownTitle: string;
}

export const PostMetrics: React.FC<PostMetricsProps> = ({
  investingEnabled,
  isClosed,
  investmentPool,
  investorCount,
  publicationId,
  breakdownPostId,
  onBreakdownClick,
  onBreakdownOpenChange,
  investorsLabel,
  viewBreakdownTitle,
}) => {
  return (
    <>
      {/* Investment block: compact, clickable → breakdown popup (C-7) — hidden when closed */}
      {investingEnabled && !isClosed && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onBreakdownClick}
            className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content/90 hover:bg-base-200 rounded-lg px-2 py-1.5 transition-colors"
            title={viewBreakdownTitle}
          >
            <span>💰</span>
            <span className="font-medium tabular-nums">{investmentPool} merits</span>
            <span className="text-base-content/50">·</span>
            <span>
              {investorCount} {investorsLabel}
            </span>
          </button>
          <InvestmentBreakdownPopup
            postId={breakdownPostId}
            open={!!breakdownPostId && breakdownPostId === publicationId}
            onOpenChange={(open) => !open && onBreakdownOpenChange(false)}
          />
        </div>
      )}
      {/* TTL badge: will be enhanced in E-2 */}
    </>
  );
};
