'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, MessageSquare, BarChart3, Briefcase } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

interface ProfileContentCardsProps {
  stats: {
    publications: number;
    comments: number;
    polls: number;
    projects: number;
  };
  isLoading?: boolean;
}

export function ProfileContentCards({
  stats,
  isLoading = false,
}: ProfileContentCardsProps) {
  const t = useTranslations('home');
  const tProfile = useTranslations('profile');
  const router = useRouter();

  const statCards = [
    {
      label: t('hero.stats.publications'),
      value: stats.publications,
      icon: FileText,
      color: 'text-base-content',
      bgColor: 'bg-base-200/50',
      route: `${routes.profile}/publications`,
    },
    {
      label: t('hero.stats.comments'),
      value: stats.comments,
      icon: MessageSquare,
      color: 'text-base-content',
      bgColor: 'bg-base-200/50',
      route: `${routes.profile}/comments`,
    },
    {
      label: t('hero.stats.polls'),
      value: stats.polls,
      icon: BarChart3,
      color: 'text-base-content',
      bgColor: 'bg-base-200/50',
      route: `${routes.profile}/polls`,
    },
    {
      label: t('hero.stats.projects'),
      value: stats.projects,
      icon: Briefcase,
      color: 'text-base-content',
      bgColor: 'bg-base-200/50',
      route: `${routes.profile}/projects`,
    },
  ];

  const handleCardClick = (route: string) => {
    router.push(route);
  };

  return (
    <div className="space-y-4">
      {/* Section Title */}
      <h2 className="text-sm font-medium text-base-content/60 uppercase tracking-wide">
        {tProfile('activity') || 'Activity'}
      </h2>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <button
              key={index}
              onClick={() => handleCardClick(stat.route)}
              className={`${stat.bgColor} rounded-xl p-4 border border-base-content/5 transition-all hover:bg-base-200 cursor-pointer text-left`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="text-base-content/40 w-5 h-5" />
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
  );
}

