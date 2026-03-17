'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users, Star } from 'lucide-react';

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

      <div className="flex flex-1 flex-col p-4 min-w-0">
        <h3 className="font-semibold text-base-content line-clamp-2 text-lg leading-tight">
          {item.name}
        </h3>
        {item.futureVisionText && (
          <p className="text-sm text-base-content/70 line-clamp-3 mt-2">
            {item.futureVisionText}
          </p>
        )}
        {item.futureVisionTags && item.futureVisionTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.futureVisionTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-base-300 text-base-content/90"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-sm text-base-content/60 mt-3">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4 flex-shrink-0" />
            {item.memberCount}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 flex-shrink-0" />
            {item.score}
          </span>
        </div>
      </div>

      <div className="border-t border-base-300 p-3 flex-shrink-0">
        <span className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {t('join')}
        </span>
      </div>
    </Link>
  );
}
