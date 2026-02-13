'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Loader2, ExternalLink } from 'lucide-react';
import { InvestmentHistoryList } from './InvestmentHistoryList';

export interface InvestmentDetailsData {
  postId: string;
  title: string;
  authorId: string;
  communityId: string;
  status: string;
  earningsHistory: Array<{
    amount: number;
    date: string;
    reason: 'withdrawal' | 'pool_return' | 'close';
  }>;
  contractPercent: number;
  ttlDays: number | null;
  ttlExpiresAt: Date | null;
  stopLoss: number;
  noAuthorWalletSpend: boolean;
  rating: number;
  investmentPool: number;
  closingSummary: {
    totalEarned: number;
    distributedToInvestors: number;
    authorReceived: number;
    spentOnShows: number;
    poolReturned: number;
  } | null;
}

export interface InvestmentDetailViewProps {
  data: InvestmentDetailsData | undefined;
  isLoading: boolean;
  onClose?: () => void;
}

function postLink(communityId: string, postId: string): string {
  return `/meriter/communities/${communityId}/posts/${postId}`;
}

export function InvestmentDetailView({
  data,
  isLoading,
  onClose,
}: InvestmentDetailViewProps) {
  const t = useTranslations('profile.investments');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-base-content/60 py-4">{t('detailsNotFound')}</p>
    );
  }

  const link = postLink(data.communityId, data.postId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-base-content line-clamp-2">
          {data.title || t('untitledPost')}
        </h3>
        <Link
          href={link}
          className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline mt-1"
        >
          {t('goToPost')}
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div>
        <h4 className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">
          {t('postSettings')}
        </h4>
        <div className="rounded-lg bg-base-200/50 p-3 text-sm space-y-1">
          <p>
            <span className="text-base-content/60">{t('contractPercent')}:</span>{' '}
            {data.contractPercent}%
          </p>
          <p>
            <span className="text-base-content/60">{t('ttl')}:</span>{' '}
            {data.ttlDays != null ? `${data.ttlDays} days` : t('noTtl')}
          </p>
          <p>
            <span className="text-base-content/60">{t('stopLoss')}:</span>{' '}
            {data.stopLoss}
          </p>
          <p>
            <span className="text-base-content/60">{t('noAuthorWalletSpend')}:</span>{' '}
            {data.noAuthorWalletSpend ? t('yes') : t('no')}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">
          {t('currentState')}
        </h4>
        <div className="rounded-lg bg-base-200/50 p-3 text-sm space-y-1">
          <p>
            <span className="text-base-content/60">{t('rating')}:</span>{' '}
            {data.rating.toFixed(1)}
          </p>
          <p>
            <span className="text-base-content/60">{t('investmentPool')}:</span>{' '}
            {data.investmentPool.toFixed(1)}
          </p>
          {data.closingSummary && (
            <div className="mt-2 pt-2 border-t border-base-300">
              <p className="text-base-content/60 text-xs uppercase">
                {t('closingSummary')}
              </p>
              <p className="text-sm">
                {t('totalEarned')}: {data.closingSummary.totalEarned.toFixed(1)},{' '}
                {t('distributedToInvestors')}:{' '}
                {data.closingSummary.distributedToInvestors.toFixed(1)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">
          {t('earningsTimeline')}
        </h4>
        <InvestmentHistoryList entries={data.earningsHistory} />
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm mt-2"
        >
          {t('close')}
        </button>
      )}
    </div>
  );
}
