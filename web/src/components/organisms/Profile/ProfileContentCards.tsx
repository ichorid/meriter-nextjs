'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Hand, BarChart3, Star, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import { useUnreadFavoritesCount } from '@/hooks/api/useFavorites';
import { useMyInvestmentsCount } from '@/hooks/api/useMyInvestments';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ProfileContentCardsProps {
  stats: {
    publications: number;
    comments: number;
    polls: number;
    projects?: number;
    favorites?: number;
  };
  isLoading?: boolean;
  /** When set, show only the four activity cards with links under `/meriter/users/:id/...`. */
  activityForUserId?: string;
  /** When used inside ProfileMeritsActivityPanel: tighter layout, no outer card */
  embedded?: boolean;
}

function ProfileContentCardsComponent({
  stats,
  isLoading = false,
  activityForUserId,
  embedded = false,
}: ProfileContentCardsProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const router = useRouter();
  const { data: unreadFavorites } = useUnreadFavoritesCount();
  const unreadFavoritesCount = unreadFavorites?.count ?? 0;
  const { count: investmentsCount, isLoading: investmentsCountLoading } = useMyInvestmentsCount();
  const activityStorageKey = activityForUserId
    ? `userProfile.${activityForUserId}.activityExpanded`
    : 'profile.activityExpanded';
  const [activityExpanded, setActivityExpanded] = useLocalStorage<boolean>(activityStorageKey, true);

  type StatCard = {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    route: string;
    isHighlighted?: boolean;
    iconClassName?: string;
    /** When true, show "..." instead of value (e.g. async count). */
    valueLoading?: boolean;
    /** Hide the numeric value column (e.g. navigational card). */
    hideValue?: boolean;
  };

  const statCards: StatCard[] = useMemo(() => {
    if (activityForUserId) {
      const uid = activityForUserId;
      return [
        {
          label: t('hero.stats.publications'),
          value: stats.publications,
          icon: FileText,
          color: 'text-base-content',
          bgColor: 'bg-gray-100 dark:bg-gray-800/50',
          route: routes.userProfilePublications(uid),
        },
        {
          label: t('hero.stats.comments'),
          value: stats.comments,
          icon: Hand,
          color: 'text-base-content',
          bgColor: 'bg-gray-100 dark:bg-gray-800/50',
          route: routes.userProfileComments(uid),
          iconClassName:
            'w-[1.2rem] h-[1.2rem] text-base-content/50 group-hover:text-base-content/70 transition-colors',
        },
        {
          label: t('hero.stats.polls'),
          value: stats.polls,
          icon: BarChart3,
          color: 'text-base-content',
          bgColor: 'bg-gray-100 dark:bg-gray-800/50',
          route: routes.userProfilePolls(uid),
        },
      ];
    }

    return [
      {
        label: t('hero.stats.publications'),
        value: stats.publications,
        icon: FileText,
        color: 'text-base-content',
        bgColor: 'bg-gray-100 dark:bg-gray-800/50',
        route: `${routes.profile}/publications`,
      },
      {
        label: t('hero.stats.comments'),
        value: stats.comments,
        icon: Hand,
        color: 'text-base-content',
        bgColor: 'bg-gray-100 dark:bg-gray-800/50',
        route: `${routes.profile}/comments`,
        iconClassName:
          'w-[1.2rem] h-[1.2rem] text-base-content/50 group-hover:text-base-content/70 transition-colors',
      },
      {
        label: t('hero.stats.polls'),
        value: stats.polls,
        icon: BarChart3,
        color: 'text-base-content',
        bgColor: 'bg-gray-100 dark:bg-gray-800/50',
        route: `${routes.profile}/polls`,
      },
      {
        label: tCommon('favorites'),
        value: stats.favorites ?? 0,
        icon: Star,
        color: 'text-base-content',
        bgColor: unreadFavoritesCount > 0 ? 'bg-warning/15' : 'bg-gray-100 dark:bg-gray-800/50',
        route: `${routes.profile}/favorites`,
        isHighlighted: unreadFavoritesCount > 0,
      },
      {
        label: tProfile('investments.title'),
        value: investmentsCount,
        icon: TrendingUp,
        color: 'text-base-content',
        bgColor: 'bg-gray-100 dark:bg-gray-800/50',
        route: `${routes.profile}/investments`,
        valueLoading: investmentsCountLoading,
      },
    ];
  }, [
    activityForUserId,
    t,
    tCommon,
    tProfile,
    stats.publications,
    stats.comments,
    stats.polls,
    stats.favorites,
    unreadFavoritesCount,
    investmentsCount,
    investmentsCountLoading,
  ]);

  const handleCardClick = (route: string) => {
    router.push(route);
  };

  return (
    <div className={cn(!embedded && 'bg-base-100 py-4', embedded ? 'space-y-2' : 'space-y-3')}>
      {/* Section Title with Toggle */}
      <button
        type="button"
        onClick={() => setActivityExpanded(!activityExpanded)}
        className="flex w-full items-center justify-between rounded-md py-0.5 transition-opacity hover:opacity-80"
      >
        <p
          className={cn(
            'font-medium uppercase tracking-wide',
            embedded
              ? 'text-[10px] text-base-content/45 sm:text-[11px]'
              : 'text-xs text-base-content/40',
          )}
        >
          {tProfile('activity')}
        </p>
        {activityExpanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-base-content/40" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-base-content/40" />
        )}
      </button>

      {/* Statistics Cards */}
      {activityExpanded && (
        <div className="animate-in fade-in duration-200">
          <div
            className={cn(
              'grid',
              embedded
                ? cn(
                    // Hairline gutters = vertical rules between cells (any column count)
                    'gap-px rounded-md bg-base-content/[0.1] p-px dark:bg-base-content/[0.14]',
                    activityForUserId ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
                  )
                : cn('grid-cols-2 gap-3 md:grid-cols-3', activityForUserId ? 'lg:grid-cols-3' : 'lg:grid-cols-5'),
            )}
          >
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleCardClick(stat.route)}
                  className={cn(
                    'cursor-pointer text-left transition-colors group',
                    embedded
                      ? cn(
                          'min-h-[3.25rem] bg-base-100 px-2 py-2 sm:min-h-[3.5rem] sm:px-2.5 sm:py-2.5',
                          'rounded-none hover:bg-base-200/50 active:bg-base-200/65',
                        )
                      : cn(stat.bgColor, 'rounded-xl p-4 transition-all hover:bg-base-200/80'),
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center',
                      stat.hideValue ? 'justify-start' : 'justify-between',
                      embedded ? 'mb-1' : 'mb-2',
                    )}
                  >
                    <Icon
                      className={
                        stat.iconClassName ||
                        cn(
                          'text-base-content/40',
                          embedded ? 'h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem]' : 'h-5 w-5',
                        )
                      }
                    />
                    {!stat.hideValue ? (
                      <span
                        className={cn(
                          'font-semibold tabular-nums text-base-content',
                          embedded ? 'text-base sm:text-lg' : 'text-2xl',
                        )}
                      >
                        {stat.valueLoading || isLoading ? '...' : stat.value}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      'font-medium text-base-content/65',
                      embedded ? 'text-[10px] leading-tight sm:text-[11px]' : 'text-xs text-base-content/60',
                    )}
                  >
                    {stat.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const ProfileContentCards = ProfileContentCardsComponent;

