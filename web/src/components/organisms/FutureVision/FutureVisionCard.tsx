'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, TrendingUp, ArrowUp, Share2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { Button } from '@/components/ui/shadcn/button';
import { formatMerits } from '@/lib/utils/currency';
import { shareUrl } from '@shared/lib/share-utils';
import { routes } from '@/lib/constants/routes';

export interface FutureVisionItem {
  communityId: string;
  name: string;
  description?: string;
  futureVisionText?: string;
  futureVisionTags?: string[];
  futureVisionCover?: string;
  publicationId: string;
  score: number;
  memberCount: number;
}

export interface FutureVisionCardProps {
  item: FutureVisionItem;
}

function futureVisionGradient(name: string): [string, string] {
  const colors: [string, string][] = [
    ['from-blue-600', 'to-purple-600'],
    ['from-emerald-500', 'to-teal-600'],
    ['from-orange-500', 'to-red-600'],
    ['from-pink-500', 'to-rose-600'],
    ['from-indigo-500', 'to-blue-600'],
    ['from-amber-500', 'to-orange-600'],
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index] ?? ['from-blue-600', 'to-purple-600'];
}

export function FutureVisionCard({ item }: FutureVisionCardProps) {
  const t = useTranslations('common');
  const tShared = useTranslations('shared');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);
  const [gradientFrom, gradientTo] = futureVisionGradient(item.name);
  const hasCover = !!item.futureVisionCover;

  const handleRatingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('post', item.publicationId);
    router.push(`${pathname ?? routes.futureVisions}?${params.toString()}`);
  };

  const handleSupportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openVotingPopup(item.publicationId, 'publication', 'wallet-only');
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = routes.community(item.communityId);
    await shareUrl(url, tShared('urlCopiedToBuffer'));
  };

  return (
    <Link
      href={`/meriter/communities/${item.communityId}`}
      className="block w-full rounded-xl overflow-hidden bg-[#F5F5F5] dark:bg-[#2a3239] p-5 shadow-none hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="h-28 w-full relative overflow-hidden flex-shrink-0 rounded-lg mb-4">
        {hasCover ? (
          <img
            src={item.futureVisionCover}
            alt=""
            className="object-cover w-full h-full"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-r ${gradientFrom} ${gradientTo}`}
            aria-hidden
          />
        )}
      </div>

      <h3 className="text-lg font-semibold text-base-content leading-tight mb-2">
        {item.name}
      </h3>
      {item.futureVisionText && (
        <p className="text-sm text-base-content/70 mb-3 line-clamp-4">
          {item.futureVisionText}
        </p>
      )}
      {item.futureVisionTags && item.futureVisionTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {item.futureVisionTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-normal text-base-content/80 bg-base-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-base-300">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
            <button
              type="button"
              onClick={handleRatingClick}
              className="flex items-center gap-1.5 text-sm hover:bg-base-200 rounded-lg px-2 py-1.5 transition-colors group flex-shrink-0"
              title={tShared('totalVotesTooltip', { defaultValue: 'Total votes including withdrawn' })}
            >
              <TrendingUp className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 flex-shrink-0" />
              <span
                className={`font-medium tabular-nums ${
                  item.score > 0
                    ? 'text-success'
                    : item.score < 0
                      ? 'text-error'
                      : 'text-base-content/60'
                }`}
              >
                {item.score > 0 ? '+' : ''}
                {formatMerits(item.score)}
              </span>
            </button>
            <span className="flex items-center gap-1.5 text-sm text-base-content/60 flex-shrink-0" aria-label={t('membersCount', { defaultValue: 'Members' })}>
              <Users className="w-4 h-4 flex-shrink-0" aria-hidden />
              {item.memberCount}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleShareClick}
              className="p-1.5 rounded-full hover:bg-base-200 transition-colors text-base-content/60 hover:text-base-content/80 flex-shrink-0"
              title={tShared('share', { defaultValue: 'Share' })}
              aria-label={tShared('share', { defaultValue: 'Share' })}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0"
              onClick={handleSupportClick}
              aria-label={t('support', { defaultValue: 'Support' })}
            >
              <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">{t('support', { defaultValue: 'Support' })}</span>
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
