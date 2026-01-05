'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Hand, BarChart3, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { useUnreadFavoritesCount } from '@/hooks/api/useFavorites';
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
}

function ProfileContentCardsComponent({
  stats,
  isLoading = false,
}: ProfileContentCardsProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const router = useRouter();
  const { data: unreadFavorites } = useUnreadFavoritesCount();
  const unreadFavoritesCount = unreadFavorites?.count ?? 0;
  const [activityExpanded, setActivityExpanded] = useLocalStorage<boolean>('profile.activityExpanded', true);

  type StatCard = {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    route: string;
    isHighlighted?: boolean;
    iconClassName?: string;
  };

  const statCards: StatCard[] = useMemo(() => [
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
      iconClassName: 'w-[1.2rem] h-[1.2rem] text-base-content/50 group-hover:text-base-content/70 transition-colors',
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
  ], [t, tCommon, stats.publications, stats.comments, stats.polls, stats.favorites, unreadFavoritesCount]);

  const handleCardClick = (route: string) => {
    router.push(route);
  };

  return (
    <div className="bg-base-100 py-4 space-y-3">
      {/* Section Title with Toggle */}
      <button
        onClick={() => setActivityExpanded(!activityExpanded)}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
      >
        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
          {tProfile('activity') || 'Activity'}
        </p>
        {activityExpanded ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>

      {/* Statistics Cards */}
      {activityExpanded && (
        <div className="animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleCardClick(stat.route)}
                  className={`${stat.bgColor} rounded-xl p-4 transition-all hover:bg-base-200 cursor-pointer text-left group`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={stat.iconClassName || "text-base-content/40 w-5 h-5"} />
                    <span className="text-2xl font-semibold text-base-content">
                      {isLoading ? '...' : stat.value}
                    </span>
                  </div>
                  <p className="text-xs text-base-content/60 font-medium">
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

