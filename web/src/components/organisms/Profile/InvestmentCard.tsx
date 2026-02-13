'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/constants/routes';

export interface InvestmentCardItem {
  postId: string;
  postTitle: string;
  postAuthor: { name: string; avatarUrl?: string };
  authorId: string;
  communityId: string;
  communityName: string;
  investedAmount: number;
  sharePercent: number;
  totalEarnings: number;
  postStatus: 'active' | 'closed';
  postRating: number;
  investmentPool: number;
  ttlExpiresAt: Date | null;
  lastWithdrawalDate: Date | null;
}

export interface InvestmentCardProps {
  item: InvestmentCardItem;
  onClick?: () => void;
}

function postLink(communityId: string, postId: string): string {
  return `/meriter/communities/${communityId}/posts/${postId}`;
}

export function InvestmentCard({ item, onClick }: InvestmentCardProps) {
  const t = useTranslations('profile.investments');

  const link = postLink(item.communityId, item.postId);

  return (
    <div
      className={cn(
        'rounded-xl border border-base-300 bg-base-100 p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-base-200/70',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={link}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-base-content hover:underline line-clamp-2"
          >
            {item.postTitle || t('untitledPost')}
          </Link>
          <p className="text-sm text-base-content/60 mt-0.5">
            <Link
              href={routes.userProfile(item.authorId)}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
            >
              {item.postAuthor.name}
            </Link>
            {' · '}
            {item.communityName}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            item.postStatus === 'active'
              ? 'bg-success/15 text-success'
              : 'bg-base-300 text-base-content/70',
          )}
        >
          {item.postStatus === 'active' ? t('statusActive') : t('statusClosed')}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div>
          <span className="text-base-content/50">{t('invested')}</span>
          <p className="font-medium text-base-content">{item.investedAmount.toFixed(1)}</p>
        </div>
        <div>
          <span className="text-base-content/50">{t('share')}</span>
          <p className="font-medium text-base-content">{item.sharePercent.toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-base-content/50">{t('earned')}</span>
          <p className="font-medium text-base-content">{item.totalEarnings.toFixed(1)}</p>
        </div>
      </div>
      {onClick && (
        <div className="mt-2 flex justify-end">
          <ChevronRight className="w-4 h-4 text-base-content/40" />
        </div>
      )}
    </div>
  );
}
