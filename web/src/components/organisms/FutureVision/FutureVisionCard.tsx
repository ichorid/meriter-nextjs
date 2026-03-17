'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users, Star, ArrowUp } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { Button } from '@/components/ui/shadcn/button';

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
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);
  const [gradientFrom, gradientTo] = futureVisionGradient(item.name);
  const hasCover = !!item.futureVisionCover;

  return (
    <Link
      href={`/meriter/communities/${item.communityId}`}
      className="flex h-full flex-col rounded-xl overflow-hidden bg-base-100 shadow-none border border-base-200 transition-all duration-200 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="aspect-video w-full relative overflow-hidden flex-shrink-0">
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

      <div className="flex flex-1 flex-col p-4 min-w-0 gap-2">
        <h3 className="font-semibold text-base-content line-clamp-2 text-lg leading-tight">
          {item.name}
        </h3>
        {item.futureVisionText && (
          <p className="text-sm text-base-content/70 line-clamp-2">
            {item.futureVisionText}
          </p>
        )}
        {item.futureVisionTags && item.futureVisionTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.futureVisionTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex px-2 py-0.5 rounded-md text-xs bg-base-300/80 text-base-content/80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-base-content/60 mt-auto">
          <span className="flex items-center gap-1" aria-label={t('membersCount', { defaultValue: 'Members' })}>
            <Users className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {item.memberCount}
          </span>
          <span className="text-base-content/40" aria-hidden>·</span>
          <span className="flex items-center gap-1" aria-label={t('ratingLabel', { defaultValue: 'Rating' })}>
            <Star className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {item.score}
          </span>
        </div>
      </div>

      <div className="border-t border-base-300 p-2.5 flex-shrink-0 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openVotingPopup(item.publicationId, 'publication', 'wallet-only');
          }}
          aria-label={t('giveMerits', { defaultValue: 'Give merits' })}
        >
          <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" />
          {t('giveMerits', { defaultValue: 'Give merits' })}
        </Button>
        <span className="flex-1 min-w-0 flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          {t('toCommunity', { defaultValue: 'To community' })}
        </span>
      </div>
    </Link>
  );
}
