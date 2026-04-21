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
import {
  trackMeriterUiEvent,
  type ActivityCardId,
  type ProfileActivityScope,
} from '@/lib/telemetry/meriter-ui-telemetry';

function activityCardFromProfileRoute(route: string): ActivityCardId | null {
  if (route.includes('/publications')) return 'publications';
  if (route.includes('/comments')) return 'comments';
  if (route.includes('/polls')) return 'polls';
  if (route.includes('/favorites')) return 'favorites';
  if (route.includes('/investments')) return 'investments';
  return null;
}

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
    const card = activityCardFromProfileRoute(route);
    const scope: ProfileActivityScope = activityForUserId ? 'other' : 'self';
    if (card) {
      trackMeriterUiEvent({ name: 'profile_activity_card_click', payload: { card, scope } });
    }
    router.push(route);
  };

  return (
    <div className={cn(!embedded && 'bg-base-100 py-4', embedded ? 'space-y-3' : 'space-y-3')}>
      {/* Section Title with Toggle */}
      <button
        type="button"
        onClick={() => setActivityExpanded(!activityExpanded)}
        className="flex w-full items-center justify-between rounded-md py-0.5 transition-opacity hover:opacity-80"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-base-content/40">
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
                    'gap-2 sm:gap-3',
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
                          'rounded-xl border border-base-content/[0.08] bg-base-200/25 p-3 sm:p-3.5',
                          'shadow-sm dark:border-base-content/[0.12] dark:bg-base-200/20',
                          'hover:border-base-content/[0.14] hover:bg-base-200/40 active:bg-base-200/55',
                          'min-h-[5.25rem] sm:min-h-[5.5rem]',
                        )
                      : cn(stat.bgColor, 'rounded-xl p-4 transition-all hover:bg-base-200/80'),
                  )}
                >
                  {embedded ? (
                    <div className="flex h-full flex-col gap-2">
                      <Icon
                        className={cn(
                          stat.iconClassName,
                          'h-5 w-5 shrink-0 text-base-content/45 transition-colors group-hover:text-base-content/65',
                        )}
                      />
                      {!stat.hideValue ? (
                        <span className="text-xl font-bold tabular-nums leading-none tracking-tight text-base-content sm:text-2xl">
                          {stat.valueLoading || isLoading ? '…' : stat.value}
                        </span>
                      ) : null}
                      <p className="mt-auto text-sm font-medium leading-snug text-base-content/75">
                        {stat.label}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        className={cn(
                          'mb-2 flex items-center',
                          stat.hideValue ? 'justify-start' : 'justify-between',
                        )}
                      >
                        <Icon
                          className={
                            stat.iconClassName ||
                            cn('h-5 w-5 text-base-content/40')
                          }
                        />
                        {!stat.hideValue ? (
                          <span className="text-2xl font-semibold tabular-nums text-base-content">
                            {stat.valueLoading || isLoading ? '...' : stat.value}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-medium text-base-content/60">{stat.label}</p>
                    </>
                  )}
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

